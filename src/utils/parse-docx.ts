import path from "path";
import fs from "fs/promises";
import { JSDOM } from "jsdom";
import { convertToHtml } from "mammoth";
import createDOMPurify from "dompurify";

import { PageData } from "@/entities/page-data";
import { generateAnchorId } from "./generate-anchor-id";
import { calculateReadingTime } from "./calculate-reading-time";

export type ParsedHeadingData = {
  id: string;
  text: string | null;
  level: number;
  depth: number;
  children?: ParsedHeadingData[];
};
export type ParsedData = {
  id: string;
  htmlString: string;
  headingsData: ParsedHeadingData[];
  meta: {
    readingTime: number;
  };
  fileMeta: {
    fileSizeInBytes: number | null;
  };
};

export async function processSource(
  data: PageData["sources"][number]
): Promise<ParsedData> {
  const localPath = path.join(process.cwd(), "public", data.path);
  const bufferLike = await fs.readFile(localPath);

  const buffer = Buffer.from(bufferLike);
  const fileSizeInBytes = buffer.byteLength;

  const { value: dirtyHtmlString, messages } = await convertToHtml(
    {
      buffer,
    },
    {
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: true,
      idPrefix: "parsed-docx-",
      styleMap: [
        `comment-reference => sup.${commentReferenceClassName}`,
        "u => u",
        "r[style-name='Emphasis'] => em",
        "p[style-name='Normal (Web)'] => p",
        "p[style-name='Subtitle'] => p.subtitle",
        "p[style-name='spoiler'] => button.spoiler",
        // "p[style-name='Quote'] => q:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "r[style-name='InlineCode'] => code",
        "p[style-name='FencedCode'] => pre > code:fresh",
        // "p[style-name='Intense Quote'] => blockquote:fresh",
        "highlight[color='yellow'] => mark.bg-amber-700",
        "highlight[color='green'] => mark.bg-green-700",
        "highlight[color='cyan'] => mark.bg-cyan-700",
        "highlight[color='magenta'] => mark.bg-pink-700",
        "highlight[color='blue'] => mark.bg-blue-700",
        "highlight[color='red'] => mark.bg-red-700",
        "highlight[color='darkYellow'] => mark.bg-yellow-700",
        "highlight[color='darkGreen'] => mark.bg-green-700",
        "highlight[color='darkCyan'] => mark.bg-cyan-700",
        "highlight[color='darkMagenta'] => mark.bg-pink-700",
        "highlight[color='darkBlue'] => mark.bg-blue-700",
        "highlight[color='darkRed'] => mark.bg-red-700",
        "highlight[color='black'] => mark.bg-black",
        "highlight[color='white'] => mark.bg-white",
      ],
    }
  );

  if (messages.length > 0) {
    messages.forEach((msg) => {
      console.log("parse docx message: ", msg.type + " " + msg.message);
    });
  }

  const jsDom = new JSDOM(dirtyHtmlString);
  const parsedDocument = jsDom.window.document;

  const headingsData: ParsedData["headingsData"] =
    prepareHeadings(parsedDocument);

  const modifiedHtml = parsedDocument.body.innerHTML;
  const DOMPurify = createDOMPurify(jsDom.window);
  const htmlString = DOMPurify.sanitize(modifiedHtml);
  const readingTime = calculateReadingTime(htmlString, 200);

  return {
    id: data.name,
    htmlString,
    headingsData,
    meta: {
      readingTime,
    },
    fileMeta: {
      fileSizeInBytes,
    },
  };
}

function prepareHeadings(parsedDocument: Document): ParsedHeadingData[] {
  const headings = parsedDocument.querySelectorAll("h1, h2, h3, h4, h5, h6");

  const headingsData: ParsedHeadingData[] = Array.from(headings).map((h) => {
    const text = h.textContent ?? "";
    const id = generateAnchorId(text);
    const level = parseInt(h.tagName[1], 10);
    h.id = id;
    return { id, text, level, depth: 0, children: [] };
  });

  const stack: ParsedHeadingData[] = [];
  const result: ParsedHeadingData[] = [];

  for (const heading of headingsData) {
    while (stack.length && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    heading.depth = stack.length;

    if (stack.length === 0) {
      result.push(heading);
    } else {
      const parent = stack[stack.length - 1];
      parent.children?.push(heading);
    }

    stack.push(heading);
  }

  return result;
}

const commentReferenceClassName = "docx-comment-reference" as const;

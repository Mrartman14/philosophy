import { JSDOM } from "jsdom";
import { convertToHtml } from "mammoth";
// import { loadAsync } from "jszip";
import createDOMPurify from "dompurify";

// import {
//   parseDocxTitle,
//   parseDocxVersion,
//   parseDocxCreator,
//   parseDocxKeywords,
//   parseDocxModifiedDate,
//   parseDocxLastModifiedBy,
// } from "./get-docx-metadata";
import { PageData } from "@/entities/page-data";
import { generateAnchorId } from "./generate-anchor-id";
import { getFilenameFromContentDisposition } from "./files";
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
    fileName: string | null;
    fileSizeInBytes: number | null;
  };
  // docxMeta?: {
  //   title: string | null;
  //   createdBy: string | null;
  //   lastModifiedBy: string | null;
  //   lastModified: Date | null;
  //   version: string | null;
  //   keywords: string | null;
  // };
};

export async function processSource(
  data: PageData["sources"][number],
  onServer = false
): Promise<ParsedData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const url = `${baseUrl}${data.path}`;
  const response = await fetch(url);
  const contentDisposition = response.headers.get("Content-Disposition");
  const fileName = getFilenameFromContentDisposition(contentDisposition);

  const docxArrayBuffer = await response.arrayBuffer();
  const fileSizeInBytes = docxArrayBuffer.byteLength;

  // const zip = await loadAsync(docxArrayBuffer);
  // const coreXml = await zip.file("docProps/core.xml")?.async("text");
  // const lastModified = coreXml ? parseDocxModifiedDate(coreXml) : null;
  // const version = coreXml ? parseDocxVersion(coreXml) : null;
  // const keywords = coreXml ? parseDocxKeywords(coreXml) : null;
  // const title = coreXml ? parseDocxTitle(coreXml) : null;
  // const createdBy = coreXml ? parseDocxCreator(coreXml) : null;
  // const lastModifiedBy = coreXml ? parseDocxLastModifiedBy(coreXml) : null;

  const options: { buffer?: Buffer<ArrayBuffer>; arrayBuffer?: ArrayBuffer } =
    {};

  if (onServer) {
    const docxBuffer = Buffer.from(docxArrayBuffer);
    options.buffer = docxBuffer;
  } else {
    options.arrayBuffer = docxArrayBuffer;
  }

  const { value: dirtyHtmlString, messages } = await convertToHtml(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(options as any),
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

  let htmlString: string;
  let readingTime: number;
  let headingsData: ParsedData["headingsData"];

  if (onServer) {
    const jsDom = new JSDOM(dirtyHtmlString);
    const parsedDocument = jsDom.window.document;

    headingsData = prepareHeadings(parsedDocument);

    // console.log(headingsData);

    const modifiedHtml = parsedDocument.body.innerHTML;
    const DOMPurify = createDOMPurify(jsDom.window);
    htmlString = DOMPurify.sanitize(modifiedHtml);

    readingTime = calculateReadingTime(htmlString, 200);
  } else {
    const cleanHtmlString = createDOMPurify().sanitize(dirtyHtmlString);
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(cleanHtmlString, "text/html");
    headingsData = prepareHeadings(parsedDocument);
    htmlString = parsedDocument.body.innerHTML;

    readingTime = calculateReadingTime(htmlString, 200);
  }

  return {
    id: data.name,
    htmlString,
    headingsData,
    // docxMeta: {
    //   title,
    //   version,
    //   keywords,
    //   createdBy,
    //   lastModified,
    //   lastModifiedBy,
    // },
    meta: {
      readingTime,
    },
    fileMeta: {
      fileName,
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

const commentReferenceClassName = "docx-comment-reference";

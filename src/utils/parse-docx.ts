import { JSDOM } from "jsdom";
import { convertToHtml } from "mammoth";
import createDOMPurify from "dompurify";

import { generateAnchorId } from "./generate-anchor-id";
import type { PageData, SourceVersion } from "./structure";

export type ParsedData = {
  version: SourceVersion;
  htmlString: string;
  headingsData: {
    id: string;
    text: string | null;
    level: number;
  }[];
  //   thesesData: {
  //     text: string;
  //     number: string;
  //   }[];
};

export async function parseDocx(pageConfig: PageData): Promise<ParsedData[]> {
  const results = await Promise.all(pageConfig.sources.map(processSource));

  return results;
}

async function processSource(
  source: PageData["sources"][number]
): Promise<ParsedData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const url = `${baseUrl}${source.path}`;
  const response = await fetch(url);
  const docxArrayBuffer = await response.arrayBuffer();
  const docxBuffer = Buffer.from(docxArrayBuffer);
  //   console.log(source.path);

  const { value: dirtyHtmlString } = await convertToHtml(
    { buffer: docxBuffer },
    {
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: true,
      styleMap: [
        "comment-reference => sup",
        "u => span.underline.decoration-1",
        "p[style-name='Quote'] => blockquote:fresh",
        "highlight[color='yellow'] => span.bg-amber-700",
        "highlight[color='green'] => span.bg-green-700",
        "highlight[color='cyan'] => span.bg-cyan-700",
        "highlight[color='magenta'] => span.bg-pink-700",
        "highlight[color='blue'] => span.bg-blue-700",
        "highlight[color='red'] => span.bg-red-700",
        "highlight[color='darkYellow'] => span.bg-yellow-700",
        "highlight[color='darkGreen'] => span.bg-green-700",
        "highlight[color='darkCyan'] => span.bg-cyan-700",
        "highlight[color='darkMagenta'] => span.bg-pink-700",
        "highlight[color='darkBlue'] => span.bg-blue-700",
        "highlight[color='darkRed'] => span.bg-red-700",
        "highlight[color='black'] => span.bg-black",
        "highlight[color='white'] => span.bg-white",
      ],
    }
  );

  const dom = new JSDOM(dirtyHtmlString);
  const { window } = dom;
  const document = window.document;

  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headingsData = Array.from(headings).map((h) => {
    const text = h.textContent;
    const id = generateAnchorId(text);
    const level = parseInt(h.tagName[1], 10);
    h.id = id;
    return { id, text, level };
  });

  //   const thesisPattern = /^#(\d+)\./;
  //   const paragraphs = document.querySelectorAll("p");
  //   const thesesData: { text: string; number: string }[] = [];
  //   paragraphs.forEach((p) => {
  //     const text = p.textContent?.trim() ?? "";
  //     const match = text.match(thesisPattern);
  //     if (match) {
  //       const number = match[1];
  //       thesesData.push({ number, text });
  //       p.remove();
  //     }
  //   });

  const modifiedHtml = document.body.innerHTML;
  const DOMPurify = createDOMPurify(window);
  const cleanHtml = DOMPurify.sanitize(modifiedHtml);

  return {
    htmlString: cleanHtml,
    headingsData,
    // thesesData,
    version: source.name,
  };
}

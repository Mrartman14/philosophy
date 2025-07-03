// import { JSDOM } from "jsdom";
import { convertToHtml } from "mammoth";
// import createDOMPurify from "dompurify";

import { generateAnchorId } from "./generate-anchor-id";
import type { PageData } from "./structure";

export type ParsedData = {
  id: string;
  htmlString: string;
  headingsData: {
    id: string;
    text: string | null;
    level: number;
  }[];
};

export async function parseDocx(pageConfig: PageData, onServer = false) {
  const results = await Promise.all(
    pageConfig.sources.map((x) => {
      return processSource(x, onServer);
    })
  );

  return results;
}

export async function processSource(
  data: PageData["sources"][number],
  onServer = false
): Promise<ParsedData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const url = `${baseUrl}${data.path}`;
  const response = await fetch(url);
  const docxArrayBuffer = await response.arrayBuffer();

  const options: { buffer?: Buffer<ArrayBuffer>; arrayBuffer?: ArrayBuffer } =
    {};

  if (onServer) {
    const docxBuffer = Buffer.from(docxArrayBuffer);
    options.buffer = docxBuffer;
  } else {
    options.arrayBuffer = docxArrayBuffer;
  }

  const { value: dirtyHtmlString } = await convertToHtml(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(options as any),
    },
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

  let htmlString: string;
  let headingsData: ParsedData["headingsData"];

  if (onServer) {
    throw new Error("not implemented yet!");
    // const jsDom = new JSDOM(dirtyHtmlString);
    // const parsedDocument = jsDom.window.document;

    // headingsData = prepareHeadings(parsedDocument);

    // const modifiedHtml = parsedDocument.body.innerHTML;
    // const DOMPurify = createDOMPurify(jsDom.window);
    // htmlString = DOMPurify.sanitize(modifiedHtml);
  } else {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(dirtyHtmlString, "text/html");
    headingsData = prepareHeadings(parsedDocument);
    htmlString = parsedDocument.body.innerHTML;
  }

  // const headings = parsedDocument.querySelectorAll("h1, h2, h3, h4, h5, h6");
  // const headingsData = Array.from(headings).map((h) => {
  //   const text = h.textContent;
  //   const id = generateAnchorId(text);
  //   const level = parseInt(h.tagName[1], 10);
  //   h.id = id;
  //   return { id, text, level };
  // });

  // let htmlString: string;

  // if (onServer) {
  //   const modifiedHtml = parsedDocument.body.innerHTML;
  //   const DOMPurify = createDOMPurify(jsDom.window);
  //   htmlString = DOMPurify.sanitize(modifiedHtml);
  // } else {
  // }

  return {
    id: data.version,
    htmlString,
    headingsData,
  };
}

function prepareHeadings(parsedDocument: Document) {
  const headings = parsedDocument.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const headingsData = Array.from(headings).map((h) => {
    const text = h.textContent;
    const id = generateAnchorId(text);
    const level = parseInt(h.tagName[1], 10);
    h.id = id;
    return { id, text, level };
  });

  return headingsData;
}

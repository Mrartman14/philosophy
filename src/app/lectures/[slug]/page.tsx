// import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import type { Metadata } from "next";
import { convertToHtml } from "mammoth";
import { notFound } from "next/navigation";
import createDOMPurify from "dompurify";

import { structure } from "@/utils/structure";
import { generateAnchorId } from "@/utils/generate-anchor-id";
import DocxViewer from "@/components/docx/docx-viewer/docx-viewer";

export async function generateStaticParams() {
  return structure.map((page) => ({ slug: page.slug }));
}

interface LecturePageParams {
  slug: string;
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const pageConfig = structure.find((p) => p.slug === slug);

  const result: Metadata = {
    title: pageConfig?.title,
  };

  return result;
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const pageConfig = structure.find((p) => p.slug === slug);
  if (!pageConfig || !pageConfig.docxUrl) return notFound();

  const prevPageConfig =
    structure.find((p) => p.order === pageConfig.order - 1) ?? null;
  const nextPageConfig =
    structure.find((p) => p.order === pageConfig.order + 1) ?? null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const url = `${baseUrl}${pageConfig.docxUrl}`;
  const response = await fetch(url);
  const docxArrayBuffer = await response.arrayBuffer();
  const docxBuffer = Buffer.from(docxArrayBuffer);

  const { value: dirtyHtmlString } = await convertToHtml(
    { buffer: docxBuffer },
    {
      includeEmbeddedStyleMap: false,
      ignoreEmptyParagraphs: true,
      styleMap: [
        "comment-reference => sup", // комменты

        "u => span.underline.decoration-1", // подчеркнутый текст

        "p[style-name='Quote'] => blockquote:fresh", // цитаты

        // бекграунд хайлайт текста
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

    return {
      id,
      text,
      level,
    };
  });

  /**
   * находятся параграфы с тезисами и удаляются из html
   * чтобы затем на клиенте отрендериться в аккордионе
   */
  const thesisPattern = /^#(\d+)\./;
  const paragraphs = document.querySelectorAll("p");
  const thesesData: { text: string; number: string }[] = [];
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() ?? "";
    const match = text.match(thesisPattern);
    if (match) {
      const number = match[1];
      thesesData.push({ number, text });
      // p.id = `thesis-${number}`;
      p.remove();
    }
  });

  const modifiedHtml = document.body.innerHTML;
  const DOMPurify = createDOMPurify(window);
  const cleanHtml = DOMPurify.sanitize(modifiedHtml);

  return (
    <div className="grid grid-cols-1">
      <DocxViewer
        data={pageConfig}
        headingsData={headingsData}
        prevData={prevPageConfig}
        nextData={nextPageConfig}
        htmlString={cleanHtml}
        thesesData={thesesData}
      />
    </div>
  );
}

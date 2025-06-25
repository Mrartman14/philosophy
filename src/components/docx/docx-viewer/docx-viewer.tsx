"use client";

import React, { useEffect, useState } from "react";
import { convertToHtml } from "mammoth";

import { PageData } from "@/structure";
import { DocxOutroLink } from "../docx-outro-link";
import { Mention } from "@/components/shared/mention";
import { PhilosopherIcon } from "@/assets/icons/philosopher-icon";
import { AsideMenu, AsideNavItem } from "../../shared/aside-menu";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

import "./docx-viewer.css";

interface DocxViewerProps {
  docxArrayBuffer: ArrayBuffer;
  data: PageData;
  prevData: PageData | null;
  nextData: PageData | null;
}
const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  prevData,
  nextData,
  docxArrayBuffer,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [parsedHtml, setParsedHtml] = useState<Document | null>(null);
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useEffect(() => {
    async function fetchAndConvert() {
      const { value } = await convertToHtml(
        { arrayBuffer: docxArrayBuffer },
        {
          includeEmbeddedStyleMap: false,
          ignoreEmptyParagraphs: true,
          styleMap: [
            "comment-reference => sup", // отображение комментов

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

      const parser = new DOMParser();
      const doc = parser.parseFromString(value, "text/html");
      const nextAsideItems: AsideNavItem[] = [];
      const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

      headings.forEach((h) => {
        const level = parseInt(h.tagName[1], 10);
        const id = (h.textContent ?? "").replaceAll(" ", "-");
        h.setAttribute("id", id);

        nextAsideItems.push({
          id,
          render: ({ isSelected }) => (
            <span
              className={`${
                isSelected ? "underline underline-offset-4" : "no-underline"
              }`}
              style={{ paddingLeft: (level - 2) * 20 }}
            >
              {h.textContent}
            </span>
          ),
        });
      });

      setParsedHtml(doc);
      setAsideItems(nextAsideItems);
    }
    fetchAndConvert();
  }, [docxArrayBuffer]);

  const outroLinks = [
    {
      href: prevData ? `/lectures/${prevData?.slug}` : undefined,
      title: "← Назад",
      description: prevData?.title,
      imageSrc: `${basePath}${prevData?.cover}`,
    },
    {
      href: nextData ? `/lectures/${nextData?.slug}` : undefined,
      title: "Вперёд →",
      description: nextData?.title,
      imageSrc: `${basePath}${nextData?.cover}`,
    },
  ];

  const proseClasses = "prose dark:prose-invert lg:prose-xl";
  const containerClasses =
    "w-full grid gap-4 border-l border-r border-(--border) p-4";

  return (
    <div className="docx-viewer grid gap-4 static w-full items-start justify-items-center grid-cols-1 md:grid-cols-[1fr_250px]">
      <div className="fixed top-0 w-full z-50">
        <ScrollProgressBar className="sticky top-0" />
      </div>
      <div className={`${proseClasses} ${containerClasses}`}>
        {data.cover ? (
          <div className="relative">
            <img
              src={`${basePath}${data.cover}`}
              alt={`${data.title} lesson preview`}
              style={{ margin: 0 }}
            />
            <div
              className="absolute p-0.5 bottom-2 right-0 w-full bg-(--text-pane)"
              style={{
                textAlign: "right",
              }}
            >
              {/* <span className="text-(--description)">{data.section}</span> */}
              <h1>{data.title}</h1>
            </div>
          </div>
        ) : (
          <h1>{data.title}</h1>
        )}
        {data.mentions.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <PhilosopherIcon className="w-6 h-6" />
            {data.mentions.map((m) => (
              <Mention
                key={m}
                className="pl-1 pr-1 border border-(--border) rounded-lg"
              >
                {m}
              </Mention>
            ))}
          </div>
        )}
        <article
          dangerouslySetInnerHTML={{ __html: parsedHtml?.body.innerHTML ?? "" }}
        />
        <div className="grid grid-cols-2 grid-rows-[150] gap-4 w-full">
          {outroLinks.map((link) => {
            if (link.href) {
              return <DocxOutroLink key={link.title} {...link} />;
            } else {
              return <div key={link.title} />;
            }
          })}
        </div>
      </div>
      <AsideMenu
        className="docx-viewer-aside hidden md:grid"
        items={asideItems}
      />
    </div>
  );
};

export default DocxViewer;

"use client";

import React, { useEffect, useState } from "react";
import { convertToHtml } from "mammoth";

import { PageData } from "@/structure";
import { DocxOutroLink } from "../docx/docx-outro-link";
import { AsideMenu, AsideNavItem } from "./aside-menu";

interface DocxViewerProps {
  data: PageData;
  prevData: PageData | null;
  nextData: PageData | null;
}
const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  prevData,
  nextData,
}) => {
  const [parsedHtml, setParsedHtml] = useState<Document | null>(null);
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useEffect(() => {
    async function fetchAndConvert() {
      const response = await fetch(data.docxUrl);
      const arrayBuffer = await response.arrayBuffer();
      const { value } = await convertToHtml(
        { arrayBuffer },
        {
          includeEmbeddedStyleMap: false,
          ignoreEmptyParagraphs: true,
          styleMap: [
            "highlight => span.highlight",
            "highlight[color='yellow'] => span.text-amber-300",
          ],
        }
      );

      const parser = new DOMParser();
      const doc = parser.parseFromString(value, "text/html");
      const nextAsideItems: AsideNavItem[] = [];

      for (let i = 1; i <= 6; i++) {
        const tag = "h" + i;
        doc.querySelectorAll(tag).forEach((h) => {
          const id = (h.textContent ?? "").replaceAll(" ", "-");
          h.setAttribute("id", id);

          nextAsideItems.push({
            id: id,
            render: ({ isSelected, depth }) => (
              <span
                className={`pl-${depth * 4} ${
                  isSelected ? "underline underline-offset-4" : "no-underline"
                }`}
              >
                {h.textContent}
              </span>
            ),
          });
        });

        setParsedHtml(doc);
        setAsideItems(nextAsideItems);
      }
    }
    fetchAndConvert();
  }, [data.docxUrl]);

  const outroLinks = [
    {
      href: prevData ? `/lectures/${prevData?.slug}` : undefined,
      title: "← Предыдущий урок",
      description: prevData?.title,
      imageSrc: prevData?.cover,
    },
    {
      href: nextData ? `/lectures/${nextData?.slug}` : undefined,
      title: "Следующий урок →",
      description: nextData?.title,
      imageSrc: nextData?.cover,
    },
  ];

  const proseClasses = "prose dark:prose-invert text-justify lg:prose-xl";
  const containerClasses =
    "w-full grid gap-4 border-l border-r border-(--border) p-4";

  return (
    <div className="grid gap-4 static w-full items-start justify-items-center grid-cols-[minmax(auto,_1fr)_250px]">
      <div className={`${proseClasses} ${containerClasses}`}>
        {data.cover ? (
          <div className="relative">
            <img
              src={data.cover}
              alt={`${data.title} lesson preview`}
              style={{ margin: 0 }}
            />
            <h1 className="absolute p-0.5 bottom-4 right-4 backdrop-blur-3xl">
              {data.title}
            </h1>
          </div>
        ) : (
          <h1>{data.title}</h1>
        )}
        <article
          dangerouslySetInnerHTML={{ __html: parsedHtml?.body.innerHTML ?? "" }}
        />
        <div className="grid grid-cols-2 grid-rows-[150] gap-4 w-full">
          {outroLinks.map((link) => (
            <DocxOutroLink key={link.title} {...link} />
          ))}
        </div>
      </div>
      <AsideMenu items={asideItems} />
    </div>
  );
};

export default DocxViewer;

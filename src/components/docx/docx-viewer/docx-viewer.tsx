"use client";

import React, { useLayoutEffect, useState } from "react";

import { PageData } from "@/utils/structure";
import { DocxOutroLink } from "../docx-outro-link";
import { Mention } from "@/components/shared/mention";
import { Expander } from "@/components/shared/expander";
import { SummaryIcon } from "@/assets/icons/summary-icon";
import { PhilosopherIcon } from "@/assets/icons/philosopher-icon";
import { AsideMenu, AsideNavItem } from "../../shared/aside-menu";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

import "./docx-viewer.css";

interface DocxViewerProps {
  htmlString: string;
  headingsData: {
    id: string;
    text: string | null;
    level: number;
  }[];
  thesesData: {
    text: string;
    number: string;
  }[];
  data: PageData;
  prevData: PageData | null;
  nextData: PageData | null;
}
const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  prevData,
  nextData,
  htmlString,
  thesesData,
  headingsData,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useLayoutEffect(() => {
    const nextAsideItems: AsideNavItem[] = [];

    headingsData.forEach((h) => {
      nextAsideItems.push({
        id: h.id,
        render: ({ isSelected }) => (
          <span
            className={`${
              isSelected ? "underline underline-offset-4" : "no-underline"
            }`}
            style={{ paddingLeft: (h.level - 2) * 20 }}
          >
            {h.text}
          </span>
        ),
      });
    });

    setAsideItems(nextAsideItems);
  }, [headingsData]);

  if (!htmlString) return null;

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
                name={m}
                withPopover
                className="pl-1 pr-1 border border-(--border) rounded-lg"
              />
            ))}
          </div>
        )}
        {thesesData.length > 0 && (
          <Expander
            trigger={
              <h5 className="flex items-center gap-2">
                <SummaryIcon />
                {thesesData.map(({ number }) => (
                  <span key={number} className="text-(--description)">
                    #{number}
                  </span>
                ))}
              </h5>
            }
          >
            {thesesData.map((x) => (
              <p key={x.number}>{x.text}</p>
            ))}
            <hr style={{ margin: 0 }} />
          </Expander>
        )}
        <article dangerouslySetInnerHTML={{ __html: htmlString }} />
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

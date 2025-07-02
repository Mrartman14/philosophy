"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";

import { PageData, SourceVersion } from "@/utils/structure";
import { ParsedData, parseDocx } from "@/utils/parse-docx";
import { DocxOutroLink } from "@/components/docx/docx-outro-link";
import { AsideMenu, AsideNavItem } from "@/components/shared/aside-menu";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";

import "./docx-viewer.css";

interface DocxViewerProps {
  // parsedData: ParsedData[];
  data: PageData;
  prevData: PageData | null;
  nextData: PageData | null;
}
const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  prevData,
  nextData,
  // parsedData,
}) => {
  const [selectedVersion, setSelectedVersion] =
    useState<SourceVersion>("Конспект");
  const allVersions = data.sources.map(({ version }) => version);
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);
  const [parsedData, setParsedData] = useState<ParsedData[]>([
    {
      headingsData: [],
      htmlString: "",
      version: data.sources[0].version ?? "Конспект",
    },
  ]);

  useEffect(() => {
    parseDocx(data, false).then(setParsedData);
  }, [data]);

  const {
    headingsData,
    htmlString,
    //  thesesData
  } = parsedData.find((x) => x.version === selectedVersion)!;

  useEffect(() => {
    const nextAsideItems: AsideNavItem[] = headingsData.map((h) => {
      return {
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
      };
    });

    setAsideItems(nextAsideItems);
  }, [headingsData]);

  if (!htmlString) return null;

  const handleSetVersion = (value: SourceVersion) => {
    setSelectedVersion(value);
  };

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
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

  const proseClasses = "prose dark:prose-invert lg:prose-xl pb-0";
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
              <h1>{data.title}</h1>
            </div>
          </div>
        ) : (
          <h1>{data.title}</h1>
        )}
        {/* {data.mentions.length > 0 && (
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
        )} */}
        <Tabs.Root
          value={selectedVersion}
          onValueChange={(x) => handleSetVersion(x)}
        >
          <Tabs.List className="flex items-center justify-center relative z-0 my-4">
            <div className="w-full border-b border-b-(--border)" />
            {allVersions.map((v) => (
              <Tabs.Tab
                className="flex items-center justify-center border-0 px-2 cursor-pointer outline-none select-none before:inset-x-0 before:inset-y-1 before:rounded-sm before:-outline-offset-1 before:outline-blue-800 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit"
                value={v}
                key={v}
              >
                <h4 style={{ margin: 0, color: "inherit" }}>{v}</h4>
              </Tabs.Tab>
            ))}
            <div className="w-full border-b border-b-(--border)" />
            <Tabs.Indicator className="border border-(--border) rounded-lg h-12 absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out" />
          </Tabs.List>
          {parsedData.map((d) => {
            return (
              <Tabs.Panel
                value={d.version}
                key={d.version}
                tabIndex={-1}
                data-version={d.version}
                render={(props) => <article {...props} />}
                dangerouslySetInnerHTML={{ __html: d.htmlString }}
              />
            );
          })}
        </Tabs.Root>
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

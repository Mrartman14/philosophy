"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";

import { LessonPageData, SourceVersion } from "@/utils/structure";
import { ParsedData, parseDocx } from "@/utils/parse-docx";
import { AsideMenu, AsideNavItem } from "@/components/shared/aside-menu";

interface DocxViewerProps {
  // parsedData: ParsedData[];
  data: LessonPageData;
  className: string;
}
const DocxViewer: React.FC<DocxViewerProps> = ({ data, className }) => {
  const [selectedVersion, setSelectedVersion] =
    useState<SourceVersion>("Конспект");
  const allVersions = data.sources.map(({ version }) => version);
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);
  const [parsedData, setParsedData] = useState<ParsedData[]>([
    {
      headingsData: [],
      htmlString: "",
      id: data.sources[0].version ?? "Конспект",
    },
  ]);

  useEffect(() => {
    parseDocx(data, false).then(setParsedData);
  }, [data]);

  const {
    headingsData,
    htmlString,
    //  thesesData
  } = parsedData.find((x) => x.id === selectedVersion)!;

  useEffect(() => {
    const nextAsideItems: AsideNavItem[] = headingsData.map((h) => {
      return {
        id: h.id,
        render: ({ isSelected }) => (
          <span
            className={`${isSelected ? "" : "text-(--description)"}`}
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

  return (
    <>
      <AsideMenu className="hidden md:grid" items={asideItems} />

      <Tabs.Root
        className={className}
        value={selectedVersion}
        onValueChange={(x) => handleSetVersion(x)}
      >
        <nav className="w-full pt-4">
          <Tabs.List
            className="flex items-center justify-center relative w-full z-0"
            render={
              <ul
                className="flex items-center"
                style={{ margin: 0, padding: 0 }}
              />
            }
          >
            <div className="w-full border-b border-b-(--border)" />
            {allVersions.map((v) => (
              <Tabs.Tab
                key={v}
                value={v}
                render={<li style={{ margin: 0 }} />}
                className="flex p-2 items-center justify-center border-0 px-2 cursor-pointer outline-none select-none before:inset-x-0 before:inset-y-1 before:rounded-sm before:-outline-offset-1 before:outline-blue-800 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit"
              >
                <h4 style={{ margin: 0, color: "inherit" }}>{v}</h4>
              </Tabs.Tab>
            ))}
            <div className="w-full border-b border-b-(--border)" />
            <Tabs.Indicator className="border border-(--border) rounded-lg h-12 absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out" />
          </Tabs.List>
        </nav>
        {parsedData.map((d) => {
          return (
            <Tabs.Panel
              value={d.id}
              key={d.id}
              tabIndex={-1}
              data-version={d.id}
              render={(props) => <article className="px-4" {...props} />}
              dangerouslySetInnerHTML={{ __html: d.htmlString }}
            />
          );
        })}
      </Tabs.Root>
    </>
  );
};

export default DocxViewer;

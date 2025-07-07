"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";

// import { DocxViewerToolbar } from "./docx-viewer-toolbar";
import { LessonPageData } from "@/entities/page-data";
import { ParsedData, parseDocx } from "@/utils/parse-docx";
import { DocxViewerMetaInfo } from "./docx-viewer-meta-info";
import { AsideMenu, AsideNavItem } from "@/components/shared/aside-menu";

interface DocxViewerProps {
  data: LessonPageData;
  className: string;
  asideClassName: string;
}
const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  className,
  asideClassName,
}) => {
  const [textAlign] = useState<React.CSSProperties["textAlign"]>("justify");

  const [selectedVersion, setSelectedVersion] = useState<string>(
    data.sources[0].name
  );
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);
  const [parsedData, setParsedData] = useState<ParsedData[]>([
    {
      headingsData: [],
      htmlString: "",
      id: data.sources[0].name,
      docxMeta: {
        title: null,
        createdBy: null,
        lastModifiedBy: null,
        version: null,
        keywords: null,
        lastModified: null,
      },
      fileMeta: {
        fileName: null,
        fileSizeInBytes: null,
      },
      meta: {
        readingTime: 0,
      },
    },
  ]);

  useEffect(() => {
    parseDocx(data, false).then(setParsedData);
  }, [data]);

  const selectedData = parsedData.find((x) => x.id === selectedVersion)!;

  const selectedSource = data.sources.find((x) => x.name === selectedVersion)!;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const sourceUrl = `${baseUrl}${selectedSource.path}`;

  useEffect(() => {
    const nextAsideItems: AsideNavItem[] = selectedData.headingsData.map(
      (h) => {
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
      }
    );

    setAsideItems(nextAsideItems);
  }, [selectedData.headingsData]);

  if (!selectedData.htmlString) return null;

  const handleSetVersion = (value: string) => {
    setSelectedVersion(value);
  };

  return (
    <>
      <div className={`w-full ${className}`}>
        {/* <DocxViewerToolbar
          sourceUrl={sourceUrl}
          selectedData={selectedData}
          textAlign={textAlign}
          onChangeTextAlign={setTextAlign}
        /> */}
        <Tabs.Root
          value={selectedVersion}
          onValueChange={(x) => handleSetVersion(x)}
        >
          <nav className="w-full">
            <Tabs.List
              className="flex items-end justify-center relative w-full z-0"
              render={
                <ul
                  className="flex items-center"
                  style={{ margin: 0, padding: 0 }}
                />
              }
            >
              <div className="w-full border-b border-b-(--border)" />
              {parsedData.map((v) => (
                <Tabs.Tab
                  key={v.id}
                  value={v.id}
                  render={<li style={{ margin: 0 }} />}
                  className="flex px-2 py-1 items-center justify-center border-b border-b-(--border) data-[selected]:border-b-0 outline-none select-none before:inset-x-0 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit"
                >
                  <h4
                    className="text-lg md:text-2xl"
                    style={{ margin: 0, color: "inherit" }}
                  >
                    {v.id}
                  </h4>
                </Tabs.Tab>
              ))}
              <div className="w-full border-b border-b-(--border)" />
              <Tabs.Indicator className="border border-(--border) rounded-lg border-b-0 rounded-bl-[0px] rounded-br-[0px] h-full absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out" />
            </Tabs.List>
          </nav>

          {parsedData.map((d) => {
            return (
              <Tabs.Panel value={d.id} key={d.id} tabIndex={-1}>
                <div className="w-full">
                  <DocxViewerMetaInfo
                    data={data}
                    parsedData={d}
                    sourceUrl={sourceUrl}
                  />
                  <style>
                    {`
                      #${d.id} p {
                        text-align: ${textAlign};
                      }
                    `}
                  </style>
                  <article
                    id={d.id}
                    className="px-4 w-full"
                    dangerouslySetInnerHTML={{ __html: d.htmlString }}
                  />
                </div>
              </Tabs.Panel>
            );
          })}
        </Tabs.Root>
      </div>
      <AsideMenu items={asideItems} className={`${asideClassName}`} />
    </>
  );
};

export default DocxViewer;

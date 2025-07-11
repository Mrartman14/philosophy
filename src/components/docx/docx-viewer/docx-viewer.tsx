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
}
const DocxViewer: React.FC<DocxViewerProps> = ({ data }) => {
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
              className={`grid gap-4 grid-rows-1 ${
                isSelected ? "" : "text-(--description)"
              }`}
              style={{
                gridTemplateColumns: `repeat(${h.depth}, 1px) 1fr`,
              }}
            >
              {[...new Array(h.depth)].map((_, i) => (
                <div key={i} className="bg-(--border)" />
              ))}
              <span className="py-1">{h.text}</span>
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
      {/* <DocxViewerToolbar
          sourceUrl={sourceUrl}
          selectedData={selectedData}
          textAlign={textAlign}
          onChangeTextAlign={setTextAlign}
        /> */}
      <Tabs.Root
        value={selectedVersion}
        className={`w-full md:mt-[-40px]`}
        onValueChange={(x) => handleSetVersion(x)}
      >
        <nav className="w-full grid grid-cols-1 overflow-x-auto">
          <Tabs.List
            render={
              <ul className="flex min-w-max whitespace-nowrap items-end justify-center relative w-full z-0" />
            }
          >
            <div className="border-b border-b-(--border) min-w-4 w-full md:w-4" />
            {data.sources.map((v) => (
              <Tabs.Tab
                key={v.name}
                value={v.name}
                render={<li />}
                className="flex px-2 py-1 items-center justify-center border-b border-b-(--border) data-[selected]:border-b-0 outline-none select-none before:inset-x-0 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit hover:text-inherit"
              >
                <h4 className="text-lg md:text-2xl font-semibold">{v.name}</h4>
              </Tabs.Tab>
            ))}
            <div className="w-full border-b border-b-(--border) min-w-4" />
            <Tabs.Indicator className="border border-(--border) rounded-lg border-b-0 rounded-bl-[0px] rounded-br-[0px] h-full absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out" />
          </Tabs.List>
        </nav>

        {parsedData.map((d) => {
          return (
            <Tabs.Panel
              value={d.id}
              key={d.id}
              className={`w-full grid grid-cols-1 md:grid-cols-[1fr_300px]`}
            >
              <style>
                {`
                  #${d.id} p {
                    text-align: ${textAlign};
                  }
                `}
              </style>
              <div className="grid gap-4 px-4 py-2 border-(--border) border-b md:border-r">
                <DocxViewerMetaInfo
                  data={data}
                  parsedData={d}
                  sourceUrl={sourceUrl}
                />
                <article
                  id={d.id}
                  className="static w-full prose dark:prose-invert md:prose-xl"
                  dangerouslySetInnerHTML={{ __html: d.htmlString }}
                />
              </div>
              <AsideMenu items={asideItems} className={`hidden md:grid`} />
            </Tabs.Panel>
          );
        })}
      </Tabs.Root>
    </>
  );
};

export default DocxViewer;

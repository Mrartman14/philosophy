"use client";

import React, { useEffect, useState } from "react";

import { PageData } from "@/entities/page-data";
// import { DocxViewerToolbar } from "./docx-viewer-toolbar";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { HourglassIcon } from "@/assets/icons/hourglass-icon";
import { ParsedData, processSource } from "@/utils/parse-docx";
import { AsideMenu, AsideNavItem } from "@/components/shared/aside-menu";
import { ShareButton } from "@/components/shared/share-button/share-button";

interface DocxViewerProps {
  data: PageData["sources"][number];
}
const DocxViewer: React.FC<DocxViewerProps> = ({ data }) => {
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);
  const [parsedData, setParsedData] = useState<ParsedData>({
    headingsData: [],
    htmlString: "",
    id: data.name,
    fileMeta: {
      fileName: null,
      fileSizeInBytes: null,
    },
    meta: {
      readingTime: 0,
    },
  });

  useEffect(() => {
    processSource(data).then(setParsedData);
  }, [data]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const sourceUrl = `${baseUrl}${data.path}`;

  useEffect(() => {
    const nextAsideItems: AsideNavItem[] = parsedData.headingsData.map((h) => {
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
    });

    setAsideItems(nextAsideItems);
  }, [parsedData.headingsData]);

  return (
    <div className={`w-full grid grid-cols-1 md:grid-cols-[1fr_300px]`}>
      {/* <DocxViewerToolbar
          sourceUrl={sourceUrl}
          selectedData={selectedData}
          textAlign={textAlign}
          onChangeTextAlign={setTextAlign}
        /> */}
      <div className="grid gap-4 p-4 border-(--border) border-b md:border-r">
        <div className={`flex items-center justify-between gap-2 text-md`}>
          <span className="flex items-center gap-2 text-(--description)">
            <HourglassIcon
              aria-label="Среднее время чтения"
              className="text-(--description)"
            />
            {parsedData.meta.readingTime} мин.
          </span>
          <div className="flex items-center gap-4">
            {/* {selectedData.meta.lastModified && (
              <span className="flex items-center gap-2 text-(--description)">
                <DocUpdateIcon />{" "}
                {getRelativeDate(selectedData.meta.lastModified)}
              </span>
            )} */}
            <a
              download
              href={sourceUrl}
              aria-label="Скачать файл"
              className="flex items-center gap-2 text-2xl text-(--description) hover:text-inherit"
            >
              <DownloadIcon />
              {/* {formatFileSize(parsedData.fileMeta.fileSizeInBytes)} */}
            </a>
            <ShareButton
              className="text-2xl text-(--description) hover:text-inherit"
              shareData={{ title: parsedData.id, url: window.location.href }}
            />
          </div>
        </div>
        <article
          id={data.name}
          className="static w-full prose dark:prose-invert md:prose-xl"
          dangerouslySetInnerHTML={{ __html: parsedData.htmlString }}
        />
      </div>
      <AsideMenu items={asideItems} className={`hidden md:grid`} />
    </div>
  );
};

export default DocxViewer;

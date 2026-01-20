import { ParsedData } from "@/utils/parse-docx";
import { PageDataSource } from "@/entities/page-data";
import { DocxViewerAside } from "./docx-viewer-aside";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { HourglassIcon } from "@/assets/icons/hourglass-icon";
import { Tractate } from "@/components/shared/tractate/tractate";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar/scroll-progress-bar";
// import { SkeletonTextBlock } from "@/components/shared/skeleton/skeleton-text-block";

interface DocxViewerProps {
  data: PageDataSource;
  parsedData: ParsedData;
}
export const DocxViewer: React.FC<DocxViewerProps> = ({ data, parsedData }) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const sourceUrl = `${baseUrl}${data.path}`;

  const ARTICLE_ID = data.name;

  return (
    <>
      {/* {!loading && ( */}
      <ScrollProgressBar
        targetElementId={ARTICLE_ID}
        className={`sticky top-(--header-height) z-50 md:col-span-2`}
      />
      {/* )} */}

      <div className={`w-full grid grid-cols-1 md:grid-cols-[1fr_300px]`}>
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
              <a
                download
                href={sourceUrl}
                aria-label="Скачать файл"
                className="flex items-center gap-2 text-xl text-(--description) hover:text-inherit"
              >
                <DownloadIcon />
              </a>
            </div>
          </div>
          <Tractate
            as="section"
            id={ARTICLE_ID}
            className="w-full"
            dangerouslySetInnerHTML={{ __html: parsedData.htmlString }}
          />
        </div>
        <DocxViewerAside parsedData={parsedData} />
      </div>
    </>
  );
};

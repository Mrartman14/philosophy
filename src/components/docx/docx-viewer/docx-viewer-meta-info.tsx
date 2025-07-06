// import { getRelativeDate } from "@/utils/dates";
// import { formatFileSize } from "@/utils/files";
import { ParsedData } from "@/utils/parse-docx";
import { LessonPageData } from "@/utils/structure";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { HourglassIcon } from "@/assets/icons/hourglass-icon";
import { ShareButton } from "@/components/shared/share-button/share-button";
// import { DocUpdateIcon } from "@/assets/icons/doc-update-icon";

type DocxViewerMetaInfoProps = {
  sourceUrl: string;
  data: LessonPageData;
  parsedData: ParsedData;
};

export const DocxViewerMetaInfo: React.FC<DocxViewerMetaInfoProps> = ({
  data,
  sourceUrl,
  parsedData,
}) => {
  return (
    <div className="flex w-full items-center justify-between gap-2 p-1 text-md px-4">
      <span className="flex items-center gap-2 text-(--description)">
        <HourglassIcon aria-label="Среднее время чтения" />
        {parsedData.meta.readingTime} мин.
      </span>
      <div className="flex items-center gap-4">
        {/* {selectedData.meta.lastModified && (
          <span className="flex items-center gap-2 text-(--description)">
            <DocUpdateIcon /> {getRelativeDate(selectedData.meta.lastModified)}
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
          shareData={{ title: data.title, url: window.location.href }}
        />
      </div>
    </div>
  );
};

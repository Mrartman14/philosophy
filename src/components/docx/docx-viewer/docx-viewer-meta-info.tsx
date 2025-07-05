// import { getRelativeDate } from "@/utils/dates";
import { ParsedData } from "@/utils/parse-docx";
import { formatFileSize } from "@/utils/files";
import { DownloadIcon } from "@/assets/icons/download-icon";
// import { DocUpdateIcon } from "@/assets/icons/doc-update-icon";

type DocxViewerMetaInfoProps = {
  sourceUrl: string;
  selectedData: ParsedData;
};

export const DocxViewerMetaInfo: React.FC<DocxViewerMetaInfoProps> = ({
  sourceUrl,
  selectedData,
}) => {
  return (
    <div className="flex w-full items-center justify-between gap-2 p-1 text-md">
      <div></div>
      <div className="flex items-center gap-2">
        {/* {selectedData.meta.lastModified && (
          <span className="flex items-center gap-1 text-(--description)">
            <DocUpdateIcon /> {getRelativeDate(selectedData.meta.lastModified)}
          </span>
        )} */}
        {selectedData.fileMeta.fileSizeInBytes && (
          <a
            download
            href={sourceUrl}
            className="flex items-center gap-1 text-(--description)"
          >
            <DownloadIcon />
            {formatFileSize(selectedData.fileMeta.fileSizeInBytes)}
          </a>
        )}
      </div>
    </div>
  );
};

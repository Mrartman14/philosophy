import {
  ParsedData,
  //  processSource
} from "@/utils/parse-docx";
import { PageData } from "@/entities/page-data";
// TODO: remove withMinDelay
// import { withMinDelay } from "@/utils/with-min-delay";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { HourglassIcon } from "@/assets/icons/hourglass-icon";
import { ShareButton } from "@/components/shared/share-button/share-button";
import { ScrollProgressBar } from "@/components/shared/scroll-progress-bar";
import { DocxViewerAside } from "./docx-viewer-aside";
// import { SkeletonTextBlock } from "@/components/shared/skeleton/skeleton-text-block";

interface DocxViewerProps {
  data: PageData["sources"][number];
  parsedData: ParsedData;
}
export const DocxViewer: React.FC<DocxViewerProps> = ({ data, parsedData }) => {
  // const [loading, setLoading] = useState(true);
  // const [parsedData, setParsedData] = useState<ParsedData>({
  //   headingsData: [],
  //   htmlString: "",
  //   id: data.name,
  //   fileMeta: {
  //     fileName: null,
  //     fileSizeInBytes: null,
  //   },
  //   meta: {
  //     readingTime: 0,
  //   },
  // });

  // useEffect(() => {
  //   withMinDelay(processSource(data), 300)
  //     .then((x) => {
  //       setParsedData(x);
  //     })
  //     .finally(() => {
  //       setLoading(false);
  //     });
  // }, [data]);

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
                className="flex items-center gap-2 text-xl text-(--description) hover:text-inherit"
              >
                <DownloadIcon />
                {/* {formatFileSize(parsedData.fileMeta.fileSizeInBytes)} */}
              </a>
              <ShareButton
                className="text-xl text-(--description) hover:text-inherit"
                shareData={{ title: parsedData.id }}
              />
            </div>
          </div>
          {/* {loading ? (
            <SkeletonTextBlock rows={50} />
          ) : ( */}
          <article
            id={ARTICLE_ID}
            className="w-full tractate"
            dangerouslySetInnerHTML={{ __html: parsedData.htmlString }}
          />
          {/* )} */}
        </div>
        <DocxViewerAside parsedData={parsedData} />
      </div>
    </>
  );
};

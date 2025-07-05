import { Toggle } from "@base-ui-components/react/toggle";
import { Toolbar } from "@base-ui-components/react/toolbar";
import { ToggleGroup } from "@base-ui-components/react/toggle-group";

import { getRelativeDate } from "@/utils/dates";
import { ParsedData } from "@/utils/parse-docx";
import { formatFileSize } from "@/utils/file-size";
import { DownloadIcon } from "@/assets/icons/download-icon";
import { DocUpdateIcon } from "@/assets/icons/doc-update-icon";
import { TextAlignLeftIcon } from "@/assets/icons/text-align-left-icon";
import { TextAlignCenterIcon } from "@/assets/icons/text-align-center-icon";
import { TextAlignJustifyIcon } from "@/assets/icons/text-align-justify-icon";

type DocxViewerToolbarProps = {
  sourceUrl: string;
  selectedData: ParsedData;
  textAlign: React.CSSProperties["textAlign"];
  onChangeTextAlign: (next: React.CSSProperties["textAlign"]) => void;
};

const alignOptions = [
  { value: "left", icon: TextAlignLeftIcon },
  { value: "center", icon: TextAlignCenterIcon },
  { value: "justify", icon: TextAlignJustifyIcon },
];
export const DocxViewerToolbar: React.FC<DocxViewerToolbarProps> = ({
  sourceUrl,
  selectedData,
  textAlign,
  onChangeTextAlign,
}) => {
  return (
    <Toolbar.Root className="flex w-full items-center gap-px rounded-md border border-(--border) p-0.5">
      <ToggleGroup
        value={[textAlign]}
        className="flex gap-1"
        aria-label="Alignment"
        onValueChange={(x) => {
          onChangeTextAlign(x[0]);
        }}
      >
        {alignOptions.map((opt) => (
          <Toolbar.Button
            key={opt.value}
            render={<Toggle />}
            aria-label={`Text align ${opt}`}
            value={opt.value}
            className="flex h-8 items-center justify-center rounded-sm px-[0.75rem] font-[inherit] text-(--description) select-none hover:bg-(--text-pane) focus-visible:bg-none focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-(--text-pane) data-[pressed]:bg-(--text-pane) data-[pressed]:text-inherit"
          >
            <opt.icon />
          </Toolbar.Button>
        ))}
      </ToggleGroup>
      <Toolbar.Separator className="m-1 h-4 w-px bg-(--border)" />
      {selectedData.meta.fileSizeInBytes && (
        <a
          download
          href={sourceUrl}
          className="flex items-center gap-2 text-(--description)"
        >
          <DownloadIcon />
          {formatFileSize(selectedData.meta.fileSizeInBytes)}
        </a>
      )}
      <Toolbar.Separator className="m-1 h-4 w-px bg-(--border)" />
      {selectedData.meta.lastModified && (
        <span className="flex items-center gap-2 text-(--description)">
          <DocUpdateIcon /> {getRelativeDate(selectedData.meta.lastModified)}
          {/* {" by "}
          {selectedData.meta.lastModifiedBy} */}
        </span>
      )}
    </Toolbar.Root>
  );
};

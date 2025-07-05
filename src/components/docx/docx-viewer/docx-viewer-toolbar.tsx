import { Toggle } from "@base-ui-components/react/toggle";
import { Toolbar } from "@base-ui-components/react/toolbar";
import { ToggleGroup } from "@base-ui-components/react/toggle-group";

import { ParsedData } from "@/utils/parse-docx";
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
  // sourceUrl,
  // selectedData,
  textAlign,
  onChangeTextAlign,
}) => {
  return (
    <Toolbar.Root className="flex w-full items-center justify-between gap-2 border-t border-b border-(--border) p-4">
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
            className="flex items-center justify-center rounded-sm py-1 px-2 font-[inherit] text-(--description) select-none hover:bg-(--text-pane) focus-visible:bg-none focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-blue-800 active:bg-(--text-pane) data-[pressed]:bg-(--text-pane) data-[pressed]:text-inherit"
          >
            <opt.icon />
          </Toolbar.Button>
        ))}
      </ToggleGroup>
    </Toolbar.Root>
  );
};

"use client";

import type { Editor } from "@tiptap/react";
import { Toolbar } from "@base-ui/react/toolbar";
import { Select } from "@base-ui/react/select";
import { Tooltip } from "@base-ui/react/tooltip";
import { BoldIcon } from "@/assets/icons/bold-icon";
import { ItalicIcon } from "@/assets/icons/italic-icon";
import { StrikethroughIcon } from "@/assets/icons/strikethrough-icon";
import { CodeIcon } from "@/assets/icons/code-icon";
import { QuoteIcon } from "@/assets/icons/quote-icon";
import { CodeBlockIcon } from "@/assets/icons/code-block-icon";
import { HorizontalRuleIcon } from "@/assets/icons/horizontal-rule-icon";
import { ListBulletIcon } from "@/assets/icons/list-bullet-icon";
import { ListOrderedIcon } from "@/assets/icons/list-ordered-icon";
import { LinkIcon } from "@/assets/icons/link-icon";
import { ImageIcon } from "@/assets/icons/image-icon";
import { TableIcon } from "@/assets/icons/table-icon";
import { ChevronDownIcon } from "@/assets/icons/chevron-down-icon";

interface EditorToolbarProps {
  editor: Editor;
}

const btnBase =
  "p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg";
const btnActive = "bg-(--color-text-pane) text-(--color-primary)";

function ToolbarTooltipButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Toolbar.Button
            aria-label={label}
            className={`${btnBase} ${active ? btnActive : ""}`}
            data-active={active ? "" : undefined}
            onClick={onClick}
          />
        }
      >
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup className="bg-(--color-background) border border-(--color-border) rounded px-2 py-1 shadow-lg text-xs text-(--color-description)">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type HeadingValue = "paragraph" | "h1" | "h2" | "h3";

const headingItems: ReadonlyArray<{ label: string; value: HeadingValue }> = [
  { label: "Параграф", value: "paragraph" },
  { label: "Заголовок 1", value: "h1" },
  { label: "Заголовок 2", value: "h2" },
  { label: "Заголовок 3", value: "h3" },
];

function getActiveHeading(editor: Editor): HeadingValue {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "paragraph";
}

function getHeadingLabel(value: HeadingValue): string {
  const item = headingItems.find((i) => i.value === value);
  return item?.label ?? "Параграф";
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  const activeHeading = getActiveHeading(editor);

  const handleHeadingChange = (value: HeadingValue | null) => {
    if (!value) return;
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = Number(value.replace("h", "")) as 1 | 2 | 3;
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  return (
    <Tooltip.Provider>
      <Toolbar.Root className="flex items-center gap-0.5 flex-wrap px-2 py-1 border-b border-(--color-border)">
        {/* Inline formatting group */}
        <Toolbar.Group className="flex items-center gap-0.5">
          <ToolbarTooltipButton
            label="Жирный"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Курсив"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Зачёркнутый"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <StrikethroughIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Код"
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <CodeIcon />
          </ToolbarTooltipButton>
        </Toolbar.Group>

        <Toolbar.Separator className="w-px h-5 bg-(--color-border) mx-1" />

        {/* Heading select */}
        <Select.Root<HeadingValue>
          value={activeHeading}
          onValueChange={handleHeadingChange}
        >
          <Select.Trigger
            className={`${btnBase} flex items-center gap-1 text-sm min-w-[120px]`}
          >
            <Select.Value placeholder="Параграф">
              {getHeadingLabel(activeHeading)}
            </Select.Value>
            <Select.Icon>
              <ChevronDownIcon />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={4}>
              <Select.Popup className="bg-(--color-background) border border-(--color-border) rounded p-1 shadow-lg">
                {headingItems.map((item) => (
                  <Select.Item
                    key={item.value}
                    value={item.value}
                    className="px-3 py-1.5 rounded text-sm cursor-pointer hover:bg-(--color-text-pane) text-(--color-description) data-[highlighted]:bg-(--color-text-pane) data-[selected]:text-(--color-primary)"
                  >
                    <Select.ItemText>{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>

        <Toolbar.Separator className="w-px h-5 bg-(--color-border) mx-1" />

        {/* Block formatting group */}
        <Toolbar.Group className="flex items-center gap-0.5">
          <ToolbarTooltipButton
            label="Цитата"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <QuoteIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Блок кода"
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <CodeBlockIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Горизонтальная линия"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <HorizontalRuleIcon />
          </ToolbarTooltipButton>
        </Toolbar.Group>

        <Toolbar.Separator className="w-px h-5 bg-(--color-border) mx-1" />

        {/* Lists group */}
        <Toolbar.Group className="flex items-center gap-0.5">
          <ToolbarTooltipButton
            label="Маркированный список"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <ListBulletIcon />
          </ToolbarTooltipButton>

          <ToolbarTooltipButton
            label="Нумерованный список"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrderedIcon />
          </ToolbarTooltipButton>
        </Toolbar.Group>

        <Toolbar.Separator className="w-px h-5 bg-(--color-border) mx-1" />

        {/* Link button */}
        <ToolbarTooltipButton
          label="Ссылка"
          active={editor.isActive("link")}
          onClick={() => {
            /* popover in Task 5 */
          }}
        >
          <LinkIcon />
        </ToolbarTooltipButton>

        {/* Image button */}
        <ToolbarTooltipButton
          label="Изображение"
          onClick={() => {
            /* popover in Task 5 */
          }}
        >
          <ImageIcon />
        </ToolbarTooltipButton>

        <Toolbar.Separator className="w-px h-5 bg-(--color-border) mx-1" />

        {/* Table button */}
        <ToolbarTooltipButton
          label="Таблица"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon />
        </ToolbarTooltipButton>
      </Toolbar.Root>
    </Tooltip.Provider>
  );
};

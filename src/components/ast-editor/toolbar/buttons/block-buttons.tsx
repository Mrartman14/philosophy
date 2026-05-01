"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { QuoteIcon } from "@/assets/icons/quote-icon";
import { CodeBlockIcon } from "@/assets/icons/code-block-icon";
import { HorizontalRuleIcon } from "@/assets/icons/horizontal-rule-icon";
import { TableIcon } from "@/assets/icons/table-icon";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function BlockButtonsGroup({ editor, schema, context }: Props) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);

  return (
    <Toolbar.Group>
      {allowed.has("blockquote") && (
        <Toolbar.Button
          aria-label="Цитата"
          aria-pressed={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </Toolbar.Button>
      )}
      {allowed.has("code_block") && (
        <Toolbar.Button
          aria-label="Блок кода"
          aria-pressed={editor.isActive("code_block")}
          onClick={() =>
            editor.chain().focus().toggleNode("code_block", "paragraph").run()
          }
        >
          <CodeBlockIcon />
        </Toolbar.Button>
      )}
      {allowed.has("thematic_break") && (
        <Toolbar.Button
          aria-label="Горизонтальная линия"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "thematic_break" })
              .run()
          }
        >
          <HorizontalRuleIcon />
        </Toolbar.Button>
      )}
      {allowed.has("table") && (
        <Toolbar.Button
          aria-label="Таблица"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: "table",
                content: [
                  {
                    type: "table_row",
                    content: [
                      { type: "table_cell" },
                      { type: "table_cell" },
                      { type: "table_cell" },
                    ],
                  },
                  {
                    type: "table_row",
                    content: [
                      { type: "table_cell" },
                      { type: "table_cell" },
                      { type: "table_cell" },
                    ],
                  },
                ],
              })
              .run()
          }
        >
          <TableIcon />
        </Toolbar.Button>
      )}
    </Toolbar.Group>
  );
}

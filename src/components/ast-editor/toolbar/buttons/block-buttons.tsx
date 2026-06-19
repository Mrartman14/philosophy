"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";

import { CodeBlockIcon } from "@/assets/icons/code-block-icon";
import { HorizontalRuleIcon } from "@/assets/icons/horizontal-rule-icon";
import { QuoteIcon } from "@/assets/icons/quote-icon";
import { TableIcon } from "@/assets/icons/table-icon";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function BlockButtonsGroup({ editor, schema, context }: Props) {
  const t = useT("editor");
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (
    !allowed.has("blockquote") &&
    !allowed.has("code_block") &&
    !allowed.has("thematic_break") &&
    !allowed.has("table")
  ) {
    return null;
  }

  return (
    <Toolbar.Group className={`flex items-center gap-1`}>
      {allowed.has("blockquote") && (
        <Toolbar.Button
          aria-label={t("blockquote")}
          aria-pressed={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </Toolbar.Button>
      )}
      {allowed.has("code_block") && (
        <Toolbar.Button
          aria-label={t("codeBlock")}
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
          aria-label={t("thematicBreak")}
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
          aria-label={t("table")}
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

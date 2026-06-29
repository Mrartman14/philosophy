"use client";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

import { BoldIcon } from "@/assets/icons/bold-icon";
import { CodeIcon } from "@/assets/icons/code-icon";
import { ItalicIcon } from "@/assets/icons/italic-icon";
import { Toolbar, Tooltip } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
}

export function InlineMarksGroup({ editor, schema }: Props) {
  const t = useT("editor");
  // Подписка на состояние редактора: useEditorState ре-рендерит кнопку при смене
  // выделения/каретки. Полагаться на shouldRerenderOnTransaction нельзя — в живом
  // приложении (TipTap v3 + next/dynamic + StrictMode) он не ре-рендерит тулбар,
  // из-за чего editor.isActive() замерзал на значении при маунте.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      code: e.isActive("code"),
    }),
  });
  if (
    !schema.marks.has("bold") &&
    !schema.marks.has("italic") &&
    !schema.marks.has("code")
  ) {
    return null;
  }
  return (
    <Toolbar.Group>
      {schema.marks.has("bold") && (
        <Tooltip content={t("bold")}>
          <Toolbar.Button
            aria-label={t("bold")}
            aria-pressed={active.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </Toolbar.Button>
        </Tooltip>
      )}
      {schema.marks.has("italic") && (
        <Tooltip content={t("italic")}>
          <Toolbar.Button
            aria-label={t("italic")}
            aria-pressed={active.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </Toolbar.Button>
        </Tooltip>
      )}
      {schema.marks.has("code") && (
        <Tooltip content={t("code")}>
          <Toolbar.Button
            aria-label={t("code")}
            aria-pressed={active.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <CodeIcon />
          </Toolbar.Button>
        </Tooltip>
      )}
    </Toolbar.Group>
  );
}

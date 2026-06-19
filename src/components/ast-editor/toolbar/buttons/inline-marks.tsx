"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";

import { BoldIcon } from "@/assets/icons/bold-icon";
import { CodeIcon } from "@/assets/icons/code-icon";
import { ItalicIcon } from "@/assets/icons/italic-icon";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
}

export function InlineMarksGroup({ editor, schema }: Props) {
  const t = useT("editor");
  if (
    !schema.marks.has("bold") &&
    !schema.marks.has("italic") &&
    !schema.marks.has("code")
  ) {
    return null;
  }
  return (
    <Toolbar.Group className={`flex items-center gap-1`}>
      {schema.marks.has("bold") && (
        <Toolbar.Button
          aria-label={t("bold")}
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </Toolbar.Button>
      )}
      {schema.marks.has("italic") && (
        <Toolbar.Button
          aria-label={t("italic")}
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </Toolbar.Button>
      )}
      {schema.marks.has("code") && (
        <Toolbar.Button
          aria-label={t("code")}
          aria-pressed={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon />
        </Toolbar.Button>
      )}
    </Toolbar.Group>
  );
}

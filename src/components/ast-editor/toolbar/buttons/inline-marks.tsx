"use client";
import type { Editor } from "@tiptap/core";
import { Toolbar } from "@base-ui/react/toolbar";
import { BoldIcon } from "@/assets/icons/bold-icon";
import { ItalicIcon } from "@/assets/icons/italic-icon";
import { CodeIcon } from "@/assets/icons/code-icon";
import type { SchemaSnapshot } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
}

export function InlineMarksGroup({ editor, schema }: Props) {
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
        <Toolbar.Button
          aria-label="Жирный"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </Toolbar.Button>
      )}
      {schema.marks.has("italic") && (
        <Toolbar.Button
          aria-label="Курсив"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </Toolbar.Button>
      )}
      {schema.marks.has("code") && (
        <Toolbar.Button
          aria-label="Код"
          aria-pressed={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon />
        </Toolbar.Button>
      )}
    </Toolbar.Group>
  );
}

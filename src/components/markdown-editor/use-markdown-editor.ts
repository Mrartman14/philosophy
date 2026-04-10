"use client";

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

export interface UseMarkdownEditorOptions {
  defaultValue?: string;
  placeholder?: string;
  editable?: boolean;
  onValueChange?: (md: string) => void;
}

export function useMarkdownEditor({
  defaultValue,
  placeholder,
  editable = true,
  onValueChange,
}: UseMarkdownEditorOptions) {
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown,
    ],
    content: defaultValue ?? "",
    onUpdate: ({ editor }) => {
      // Tiptap types editor.storage as empty Storage; tiptap-markdown registers its storage at runtime
      const storage = editor.storage as unknown as { markdown: MarkdownStorage };
      const md = storage.markdown.getMarkdown();
      onValueChange?.(md);
    },
  });

  return editor;
}

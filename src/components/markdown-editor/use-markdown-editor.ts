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
  defaultValue?: string | undefined;
  placeholder?: string | undefined;
  editable?: boolean;
  ariaLabel?: string | undefined;
  onValueChange?: (md: string) => void;
}

export function useMarkdownEditor({
  defaultValue,
  placeholder,
  editable = true,
  ariaLabel,
  onValueChange,
}: UseMarkdownEditorOptions) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? "Редактор текста",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
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
        const storage = editor.storage as unknown as Record<string, unknown>;
        const markdownStorage = storage.markdown as
          | MarkdownStorage
          | undefined;
        const md = markdownStorage?.getMarkdown() ?? "";
        onValueChange?.(md);
      },
    },
    [editable],
  );

  return editor;
}

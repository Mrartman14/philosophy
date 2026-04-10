"use client";

import { useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useMarkdownEditor } from "./use-markdown-editor";
import { EditorToolbar } from "./toolbar";

interface MarkdownEditorProps {
  defaultValue?: string;
  onValueChange?: (md: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  defaultValue,
  onValueChange,
  name,
  placeholder,
  disabled,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const editor = useMarkdownEditor({
    ...(defaultValue !== undefined && { defaultValue }),
    ...(placeholder !== undefined && { placeholder }),
    editable: !disabled,
    onValueChange: (md) => {
      onValueChange?.(md);
      if (inputRef.current) inputRef.current.value = md;
    },
  });

  if (!editor) return null;

  return (
    <div
      className={`markdown-editor border border-(--color-border) rounded-lg overflow-hidden
        focus-within:ring-2 focus-within:ring-(--color-primary)/30
        ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none
          prose-headings:text-(--foreground)
          prose-p:text-(--foreground)
          prose-a:text-(--color-link)
          prose-strong:text-(--foreground)
          prose-code:text-(--foreground)
          prose-blockquote:border-(--color-border)"
      />
      {name && (
        <input
          ref={inputRef}
          type="hidden"
          name={name}
          defaultValue={defaultValue ?? ""}
        />
      )}
    </div>
  );
};

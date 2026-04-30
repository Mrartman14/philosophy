"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useAstEditor } from "./use-ast-editor";
import { useSchema } from "./schema-context";
import { serialize } from "./serializer";
import type { ProseMirrorJSON } from "./serializer";
import type { AstBlock, EntityContext } from "./types";

export interface AstEditorProps {
  defaultValue?: AstBlock[];
  value?: AstBlock[];
  onChange?: (blocks: AstBlock[]) => void;
  entityContext: EntityContext;
  defaultLectureId?: string;
  name?: string;
  editable?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export interface AstEditorRef {
  getBlocks(): AstBlock[];
  validate(): string | null;
}

export const AstEditor = forwardRef<AstEditorRef, AstEditorProps>(function AstEditor(
  props,
  ref,
) {
  const schema = useSchema();
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (blocks: AstBlock[]) => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = JSON.stringify(blocks);
    }
    props.onChange?.(blocks);
  };

  const editor = useAstEditor({
    defaultValue: props.defaultValue ?? props.value ?? [],
    entityContext: props.entityContext,
    editable: props.editable !== false,
    placeholder: props.placeholder,
    ariaLabel: props.ariaLabel,
    schema,
    onChange: handleChange,
  });

  useImperativeHandle(
    ref,
    () => ({
      getBlocks: () => {
        if (!editor) return [];
        const json = editor.getJSON() as ProseMirrorJSON;
        return serialize(json);
      },
      // Phase 2: surface ProseMirror plugin state for last validation error.
      validate: () => null,
    }),
    [editor],
  );

  if (!editor) return null;

  return (
    <div
      className={`ast-editor border border-(--color-border) rounded-lg overflow-hidden
        ${props.editable === false ? "opacity-50 pointer-events-none" : ""}`}
    >
      <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      {props.name ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={props.name}
          defaultValue={JSON.stringify(props.defaultValue ?? props.value ?? [])}
        />
      ) : null}
    </div>
  );
});

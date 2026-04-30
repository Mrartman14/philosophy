"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent } from "@tiptap/react";
import { useAstEditor } from "./use-ast-editor";
import { useSchema } from "./schema-context";
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
  const editor = useAstEditor({
    defaultValue: props.defaultValue ?? props.value ?? [],
    entityContext: props.entityContext,
    editable: props.editable !== false,
    placeholder: props.placeholder,
    ariaLabel: props.ariaLabel,
    schema,
    onChange: props.onChange,
  });

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      getBlocks: () => [], // stub — wired in Task 22
      validate: () => null, // stub — wired in Task 22
    }),
    [],
  );

  // hidden-input sync — wired in Task 22
  useEffect(() => undefined, []);

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

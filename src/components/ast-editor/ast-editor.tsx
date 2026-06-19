"use client";

import { Extension } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { forwardRef, useImperativeHandle, useRef } from "react";

import { useDriftWarn } from "./drift-warn";
import { AtMenu } from "./pickers/at-menu";
import { createAtSuggestionPlugin } from "./pickers/at-suggestion-plugin";
import { useSchema } from "./schema-context";
import { serialize } from "./serializer";
import type { ProseMirrorJSON } from "./serializer";
import { SlashMenu } from "./toolbar/slash-menu";
import { createSlashMenuPlugin } from "./toolbar/slash-menu-plugin";
import { EditorToolbar } from "./toolbar/toolbar";
import type { AstBlock, EntityContext } from "./types";
import { useAstEditor } from "./use-ast-editor";

const slashHost = Extension.create({
  name: "slash-menu-host",
  addProseMirrorPlugins() {
    return [createSlashMenuPlugin()];
  },
});

const atHost = Extension.create({
  name: "at-suggestion-host",
  addProseMirrorPlugins() {
    return [createAtSuggestionPlugin()];
  },
});

export interface AstEditorProps {
  /**
   * Initial document. Editor is uncontrolled: Tiptap owns the live content,
   * read it back via onChange or imperative ref.getBlocks(). Re-pass with
   * a different `key` to remount and reset.
   */
  defaultValue?: AstBlock[];
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
    defaultValue: props.defaultValue ?? [],
    entityContext: props.entityContext,
    editable: props.editable !== false,
    placeholder: props.placeholder,
    ariaLabel: props.ariaLabel,
    schema,
    onChange: handleChange,
    extraExtensions: [slashHost, atHost],
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

  useDriftWarn(schema);

  if (!editor) return null;

  return (
    <div
      className={`ast-editor border border-(--color-border) rounded-lg overflow-hidden
        ${props.editable === false ? "opacity-50 pointer-events-none" : ""}`}
    >
      {props.editable !== false && (
        <EditorToolbar
          editor={editor}
          schema={schema}
          context={props.entityContext}
          defaultLectureId={props.defaultLectureId}
        />
      )}
      <EditorContent editor={editor} className="content" data-size="sm" />
      {props.editable !== false && (
        <SlashMenu editor={editor} schema={schema} context={props.entityContext} />
      )}
      {props.editable !== false && (
        <AtMenu editor={editor} defaultLectureId={props.defaultLectureId} />
      )}
      {props.name ? (
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={props.name}
          defaultValue={JSON.stringify(props.defaultValue ?? [])}
        />
      ) : null}
    </div>
  );
});

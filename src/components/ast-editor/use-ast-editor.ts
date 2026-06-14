"use client";

import type { Extensions } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";

import { deserialize } from "./deserializer";
import { buildExtensions } from "./extensions";
import { serialize } from "./serializer";
import type { ProseMirrorJSON } from "./serializer";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";

export interface UseAstEditorOptions {
  defaultValue?: AstBlock[] | undefined;
  entityContext: EntityContext;
  editable?: boolean | undefined;
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  schema: SchemaSnapshot;
  onChange?: ((blocks: AstBlock[]) => void) | undefined;
  extraExtensions?: Extensions | undefined;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { defaultValue, entityContext, editable = true, placeholder, ariaLabel, schema, onChange, extraExtensions } = opts;
  return useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? "Редактор AST",
          role: "textbox",
          "aria-multiline": "true",
        },
      },
      extensions: [...buildExtensions({ snapshot: schema, context: entityContext, placeholder }), ...(extraExtensions ?? [])],
      content: deserialize(defaultValue ?? [], schema),
      onUpdate({ editor }) {
        if (!onChange) return;
        const json = editor.getJSON() as ProseMirrorJSON;
        onChange(serialize(json));
      },
    },
    [editable, entityContext],
  );
}

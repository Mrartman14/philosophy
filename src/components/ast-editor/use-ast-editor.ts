"use client";

import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";
import { buildExtensions } from "./extensions";
import { deserialize } from "./deserializer";

export interface UseAstEditorOptions {
  defaultValue?: AstBlock[] | undefined;
  entityContext: EntityContext;
  editable?: boolean | undefined;
  placeholder?: string | undefined;
  ariaLabel?: string | undefined;
  schema: SchemaSnapshot;
  onChange?: ((blocks: AstBlock[]) => void) | undefined;
}

export function useAstEditor(opts: UseAstEditorOptions): Editor | null {
  const { defaultValue, entityContext, editable = true, placeholder, ariaLabel, schema } = opts;
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
      extensions: buildExtensions({ snapshot: schema, context: entityContext, placeholder }),
      content: deserialize(defaultValue ?? [], schema),
    },
    [editable, entityContext],
  );
}

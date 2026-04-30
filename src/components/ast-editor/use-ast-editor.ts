"use client";

import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/react";
import type { AstBlock, EntityContext, SchemaSnapshot } from "./types";

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
  const { defaultValue, editable = true, placeholder, ariaLabel } = opts;
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
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: placeholder ?? "" }),
      ],
      content: { type: "doc", content: deserializePlaceholder(defaultValue) },
    },
    [editable],
  );
}

// Stub — implemented in Task 17 (deserializer).
function deserializePlaceholder(_blocks?: AstBlock[]) {
  return [{ type: "paragraph" }];
}

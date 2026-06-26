"use client";

import type { Extensions } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";

import { useT } from "@/i18n/client";

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
  const t = useT("editor");
  return useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel ?? t("editorAriaLabel"),
          role: "textbox",
          "aria-multiline": "true",
          // `.content` на самом узле ProseMirror, а не на обёртке EditorContent:
          // блоки должны быть ПРЯМЫМИ детьми `.content`, иначе flow-селекторы
          // content.css (`.content > * + *`, `.content > :is(h1..h6)`) не матчатся
          // и пропадает вертикальный ритм. + p-1 (отступ как у тулбара) и снятие
          // нативного focus-outline contenteditable.
          class: "content p-1 outline-none",
          "data-size": "sm",
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

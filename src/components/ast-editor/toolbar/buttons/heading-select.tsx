"use client";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

type Value = "paragraph" | `h${1 | 2 | 3 | 4 | 5 | 6}`;

function getActive(editor: Editor): Value {
  for (
    let l = 1 as 1 | 2 | 3 | 4 | 5 | 6;
    l <= 6;
    l = (l + 1) as 1 | 2 | 3 | 4 | 5 | 6
  ) {
    if (editor.isActive("heading", { level: l })) return `h${l}` as Value;
  }
  return "paragraph";
}

export function HeadingSelect({ editor, schema, context }: Props) {
  const t = useT("editor");
  // Реактивный активный уровень заголовка через useEditorState (см. inline-marks).
  const active = useEditorState({ editor, selector: ({ editor: e }) => getActive(e) });
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("heading")) return null;

  const items: { label: string; value: Value }[] = [
    { label: t("paragraph"), value: "paragraph" },
    { label: t("heading1"), value: "h1" },
    { label: t("heading2"), value: "h2" },
    { label: t("heading3"), value: "h3" },
    { label: t("heading4"), value: "h4" },
    { label: t("heading5"), value: "h5" },
    { label: t("heading6"), value: "h6" },
  ];

  const onChange = (v: string) => {
    if (!v) return;
    if (v === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      editor
        .chain()
        .focus()
        .setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 })
        .run();
    }
  };

  return (
    <Select
      aria-label={t("blockTypeAriaLabel")}
      value={active}
      onValueChange={onChange}
      options={items}
    />
  );
}

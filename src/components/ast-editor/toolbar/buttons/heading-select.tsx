"use client";
import type { Editor } from "@tiptap/core";
import { Select } from "@/components/ui/select";
import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

type Value = "paragraph" | `h${1 | 2 | 3 | 4 | 5 | 6}`;

const items: Array<{ label: string; value: Value }> = [
  { label: "Параграф", value: "paragraph" },
  { label: "Заголовок 1", value: "h1" },
  { label: "Заголовок 2", value: "h2" },
  { label: "Заголовок 3", value: "h3" },
  { label: "Заголовок 4", value: "h4" },
  { label: "Заголовок 5", value: "h5" },
  { label: "Заголовок 6", value: "h6" },
];

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
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("heading")) return null;

  const active = getActive(editor);
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
      aria-label="Тип блока"
      value={active}
      onValueChange={onChange}
      options={items}
    />
  );
}

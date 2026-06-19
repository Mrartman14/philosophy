"use client";
import { Toolbar } from "@base-ui/react/toolbar";
import type { Editor } from "@tiptap/core";

import { ListBulletIcon } from "@/assets/icons/list-bullet-icon";
import { ListOrderedIcon } from "@/assets/icons/list-ordered-icon";

import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function ListButtonsGroup({ editor, schema, context }: Props) {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("list")) return null;

  // ListExt in Phase 1 is a custom Node.create({ name: "list" }) without
  // Tiptap helpers (toggleBulletList/toggleOrderedList/toggleList are not registered).
  // Universal commands wrapIn / lift / updateAttributes are what works.
  const toggle = (ordered: boolean, asTask = false) => {
    if (editor.isActive("list", { ordered })) {
      editor.chain().focus().lift("list_item").run();
      return;
    }
    editor.chain().focus().wrapIn("list", { ordered }).run();
    if (asTask) {
      editor.chain().focus().updateAttributes("list_item", { checked: false }).run();
    }
  };

  const itemChecked = (editor.getAttributes("list_item") as { checked?: boolean | null } | undefined)?.checked;
  const isTaskActive = editor.isActive("list_item") && itemChecked != null;

  return (
    <Toolbar.Group className={`flex items-center gap-1`}>
      <Toolbar.Button
        aria-label="Маркированный список"
        aria-pressed={editor.isActive("list", { ordered: false })}
        onClick={() => { toggle(false); }}
      >
        <ListBulletIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label="Нумерованный список"
        aria-pressed={editor.isActive("list", { ordered: true })}
        onClick={() => { toggle(true); }}
      >
        <ListOrderedIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label="Чек-лист"
        aria-pressed={isTaskActive}
        onClick={() => { toggle(false, true); }}
      >
        ☐
      </Toolbar.Button>
    </Toolbar.Group>
  );
}

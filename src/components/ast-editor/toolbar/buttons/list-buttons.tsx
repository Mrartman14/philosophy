"use client";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

import { ListBulletIcon } from "@/assets/icons/list-bullet-icon";
import { ListOrderedIcon } from "@/assets/icons/list-ordered-icon";
import { Toolbar } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot, EntityContext } from "../../types";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function ListButtonsGroup({ editor, schema, context }: Props) {
  const t = useT("editor");
  // Реактивное активное состояние через useEditorState (см. inline-marks).
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const itemChecked = (e.getAttributes("list_item") as { checked?: boolean | null } | undefined)?.checked;
      return {
        bullet: e.isActive("list", { ordered: false }),
        ordered: e.isActive("list", { ordered: true }),
        task: e.isActive("list_item") && itemChecked != null,
      };
    },
  });
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

  return (
    <Toolbar.Group>
      <Toolbar.Button
        aria-label={t("bulletList")}
        aria-pressed={active.bullet}
        onClick={() => { toggle(false); }}
      >
        <ListBulletIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label={t("orderedList")}
        aria-pressed={active.ordered}
        onClick={() => { toggle(true); }}
      >
        <ListOrderedIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label={t("checkList")}
        aria-pressed={active.task}
        onClick={() => { toggle(false, true); }}
      >
        ☐
      </Toolbar.Button>
    </Toolbar.Group>
  );
}

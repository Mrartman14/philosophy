"use client";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

import { ListBulletIcon } from "@/assets/icons/list-bullet-icon";
import { ListChecklistIcon } from "@/assets/icons/list-checklist-icon";
import { ListOrderedIcon } from "@/assets/icons/list-ordered-icon";
import { Toolbar } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot, EntityContext } from "../../types";

import { listActiveState, applyListKind } from "./list-actions";

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function ListButtonsGroup({ editor, schema, context }: Props) {
  const t = useT("editor");
  // Реактивное активное состояние через useEditorState (см. inline-marks).
  // Три ВЗАИМОИСКЛЮЧАЮЩИХ режима — см. list-actions.listActiveState.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => listActiveState(e),
  });
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  if (!allowed.has("list")) return null;

  return (
    <Toolbar.Group>
      <Toolbar.Button
        aria-label={t("bulletList")}
        aria-pressed={active.bullet}
        onClick={() => { applyListKind(editor, "bullet"); }}
      >
        <ListBulletIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label={t("orderedList")}
        aria-pressed={active.ordered}
        onClick={() => { applyListKind(editor, "ordered"); }}
      >
        <ListOrderedIcon />
      </Toolbar.Button>
      <Toolbar.Button
        aria-label={t("checkList")}
        aria-pressed={active.task}
        onClick={() => { applyListKind(editor, "task"); }}
      >
        <ListChecklistIcon />
      </Toolbar.Button>
    </Toolbar.Group>
  );
}

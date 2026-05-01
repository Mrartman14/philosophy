// src/components/ast-editor/toolbar/slash-menu.tsx
"use client";
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { slashMenuKey, consumeSlashMarker, closeSlashMenu } from "./slash-menu-plugin";
import type { SchemaSnapshot, EntityContext } from "../types";

interface Cmd {
  id: string;
  label: string;
  run: (editor: Editor) => void;
}

function buildCommands(schema: SchemaSnapshot, context: EntityContext): Cmd[] {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  const cmds: Cmd[] = [];

  if (allowed.has("heading")) {
    for (const l of [1, 2, 3] as const) {
      cmds.push({
        id: `h${l}`,
        label: `Заголовок ${l}`,
        run: (e) => e.chain().focus().setHeading({ level: l }).run(),
      });
    }
  }
  if (allowed.has("blockquote")) {
    cmds.push({
      id: "bq",
      label: "Цитата",
      run: (e) => e.chain().focus().wrapIn("blockquote").run(),
    });
  }
  if (allowed.has("code_block")) {
    cmds.push({
      id: "cb",
      label: "Блок кода",
      run: (e) => e.chain().focus().toggleNode("code_block", "paragraph").run(),
    });
  }
  if (allowed.has("list")) {
    cmds.push({
      id: "ul",
      label: "Маркированный список",
      run: (e) => e.chain().focus().wrapIn("list", { ordered: false }).run(),
    });
    cmds.push({
      id: "ol",
      label: "Нумерованный список",
      run: (e) => e.chain().focus().wrapIn("list", { ordered: true }).run(),
    });
  }
  if (allowed.has("thematic_break")) {
    cmds.push({
      id: "hr",
      label: "Линия",
      run: (e) => e.chain().focus().insertContent({ type: "thematic_break" }).run(),
    });
  }
  if (allowed.has("table")) {
    cmds.push({
      id: "table",
      label: "Таблица 3×3",
      run: (e) =>
        e
          .chain()
          .focus()
          .insertContent({
            type: "table",
            content: [
              {
                type: "table_row",
                content: [
                  { type: "table_cell" },
                  { type: "table_cell" },
                  { type: "table_cell" },
                ],
              },
              {
                type: "table_row",
                content: [
                  { type: "table_cell" },
                  { type: "table_cell" },
                  { type: "table_cell" },
                ],
              },
              {
                type: "table_row",
                content: [
                  { type: "table_cell" },
                  { type: "table_cell" },
                  { type: "table_cell" },
                ],
              },
            ],
          })
          .run(),
    });
  }
  return cmds;
}

interface Props {
  editor: Editor;
  schema: SchemaSnapshot;
  context: EntityContext;
}

export function SlashMenu({ editor, schema, context }: Props) {
  const [state, setState] = useState({ open: false, from: -1, query: "" });
  const [active, setActive] = useState(0);

  useEffect(() => {
    const upd = () => {
      const s = slashMenuKey.getState(editor.view.state);
      if (s) setState(s);
    };
    editor.on("transaction", upd);
    return () => {
      editor.off("transaction", upd);
    };
  }, [editor]);

  const allCmds = buildCommands(schema, context);
  const cmds = state.query
    ? allCmds.filter((c) => c.label.toLowerCase().includes(state.query.toLowerCase()))
    : allCmds;

  if (!state.open || cmds.length === 0) return null;

  const apply = (cmd: Cmd) => {
    consumeSlashMarker(editor.view, state.from);
    cmd.run(editor);
  };

  return (
    <div role="listbox" aria-label="Команды блока" className="ast-slash-menu">
      {cmds.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={active === i}
          onMouseDown={(e) => {
            e.preventDefault();
            apply(c);
          }}
          onMouseEnter={() => setActive(i)}
        >
          {c.label}
        </button>
      ))}
      <button type="button" onClick={() => closeSlashMenu(editor.view)}>
        Esc — закрыть
      </button>
    </div>
  );
}

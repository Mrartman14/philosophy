"use client";
import type { Editor } from "@tiptap/core";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { SchemaSnapshot, EntityContext } from "../types";

import { slashMenuKey, consumeSlashMarker, closeSlashMenu } from "./slash-menu-plugin";


interface Cmd {
  id: string;
  label: string;
  run: (editor: Editor) => void;
}

type EditorT = ReturnType<typeof useT<"editor">>;

function buildCommands(schema: SchemaSnapshot, context: EntityContext, t: EditorT): Cmd[] {
  const level = schema.entityContexts[context] ?? "";
  const allowed = new Set(schema.blockLevels[level] ?? []);
  const cmds: Cmd[] = [];

  if (allowed.has("heading")) {
    for (const l of [1, 2, 3] as const) {
      cmds.push({
        id: `h${l}`,
        label: t("slashMenuHeading", { level: l }),
        run: (e) => e.chain().focus().setHeading({ level: l }).run(),
      });
    }
  }
  if (allowed.has("blockquote")) {
    cmds.push({
      id: "bq",
      label: t("slashMenuBlockquote"),
      run: (e) => e.chain().focus().wrapIn("blockquote").run(),
    });
  }
  if (allowed.has("code_block")) {
    cmds.push({
      id: "cb",
      label: t("slashMenuCodeBlock"),
      run: (e) => e.chain().focus().toggleNode("code_block", "paragraph").run(),
    });
  }
  if (allowed.has("list")) {
    cmds.push({
      id: "ul",
      label: t("slashMenuBulletList"),
      run: (e) => e.chain().focus().wrapIn("list", { ordered: false }).run(),
    });
    cmds.push({
      id: "ol",
      label: t("slashMenuOrderedList"),
      run: (e) => e.chain().focus().wrapIn("list", { ordered: true }).run(),
    });
  }
  if (allowed.has("thematic_break")) {
    cmds.push({
      id: "hr",
      label: t("slashMenuThematicBreak"),
      run: (e) => e.chain().focus().insertContent({ type: "thematic_break" }).run(),
    });
  }
  if (allowed.has("table")) {
    cmds.push({
      id: "table",
      label: t("slashMenuTable"),
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
  const t = useT("editor");
  const listboxId = useId();
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

  const allCmds = buildCommands(schema, context, t);
  const cmds = state.query
    ? allCmds.filter((c) => c.label.toLowerCase().includes(state.query.toLowerCase()))
    : allCmds;

  // Reset active to 0 whenever menu opens or query changes.
  useEffect(() => {
    setActive(0);
  }, [state.open, state.query]);

  // Clamp active in case cmds list shrinks below the current index.
  const safeActive = cmds.length > 0 ? Math.min(active, cmds.length - 1) : 0;

  // Bridge the listbox to the focused contenteditable so screen readers announce
  // when the menu opens and each time the active item changes.
  // aria-activedescendant is only honoured on the focused element, so we set it
  // directly on editor.view.dom (the ProseMirror contenteditable) while open.
  useEffect(() => {
    const dom = editor.view.dom;
    if (state.open && cmds.length > 0) {
      dom.setAttribute("aria-controls", listboxId);
      dom.setAttribute("aria-activedescendant", `${listboxId}-opt-${String(safeActive)}`);
    } else {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    }
    return () => {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-activedescendant");
    };
  }, [state.open, safeActive, cmds.length, listboxId, editor]);

  const apply = (cmd: Cmd) => {
    consumeSlashMarker(editor.view, state.from);
    cmd.run(editor);
  };

  // Document-level capture-phase listener: intercepts ArrowUp/ArrowDown/Enter
  // before ProseMirror's bubble-phase handler so the editor caret doesn't move.
  // Esc is handled inside the plugin itself.
  useEffect(() => {
    if (!state.open || cmds.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => (a + 1) % cmds.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => (a - 1 + cmds.length) % cmds.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const idx = Math.min(active, cmds.length - 1);
        const cmd = cmds[idx];
        if (cmd) apply(cmd);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => { document.removeEventListener("keydown", handler, true); };
    // `apply` and `cmds` are derived per render and intentionally not in deps
    // — handler closure captures the latest at attach time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.from, state.query, active]);

  if (!state.open) return null;
  if (cmds.length === 0) {
    return (
      <div role="status" className="ast-slash-menu ast-slash-menu--empty">
        {t("slashMenuNoMatches")}
      </div>
    );
  }

  return (
    <div id={listboxId} role="listbox" aria-label={t("slashMenuAriaLabel")} className="ast-slash-menu">
      {cmds.map((c, i) => (
        <Button
          key={c.id}
          id={`${listboxId}-opt-${String(i)}`}
          variant="ghost"
          size="sm"
          role="option"
          aria-selected={safeActive === i}
          className="w-full justify-start"
          onMouseDown={(e) => {
            e.preventDefault();
            apply(c);
          }}
          onMouseEnter={() => { setActive(i); }}
        >
          {c.label}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={() => { closeSlashMenu(editor.view); }}
      >
        {t("slashMenuClose")}
      </Button>
    </div>
  );
}

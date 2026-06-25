// Интерактивный чекбокс задачи в ЖИВОМ редакторе. Без nodeView редактор берёт
// статичный renderHTML из общей карты — там disabled-чекбокс (нужный для read),
// который НЕ кликается. nodeView переопределяет его на enabled + onChange.
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";

import type { SchemaSnapshot } from "../../types";
import { buildExtensions } from "../index";

vi.mock("@/i18n/client", () => ({
  useT: () => (k: string) => k,
}));

afterEach(cleanup);

const fullSnapshot: SchemaSnapshot = {
  blockLevels: {
    full: ["paragraph", "heading", "blockquote", "code_block", "list", "image", "table", "thematic_break"],
  },
  entityBlockLimits: { full: 20000 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 1_000_000, maxContentItems: 10_000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

interface PMJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMJson[];
  text?: string;
}

function taskDoc(checked: boolean): PMJson {
  return {
    type: "doc",
    content: [
      {
        type: "list",
        attrs: { ordered: false },
        content: [
          {
            type: "list_item",
            attrs: { checked },
            content: [{ type: "paragraph", content: [{ type: "text", text: "задача" }] }],
          },
        ],
      },
    ],
  };
}

function Harness({ doc, onReady }: { doc: PMJson; onReady: (e: Editor) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
    content: doc,
  });
  useEffect(() => {
    if (editor) onReady(editor);
  }, [editor, onReady]);
  return editor ? <EditorContent editor={editor} /> : null;
}

function itemChecked(ed: Editor): unknown {
  const json = ed.getJSON() as PMJson;
  return json.content?.[0]?.content?.[0]?.attrs?.checked;
}

describe("ListItem nodeView — интерактивный чекбокс", () => {
  it("чекбокс задачи в редакторе АКТИВЕН (не disabled)", async () => {
    render(<Harness doc={taskDoc(false)} onReady={() => undefined} />);
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeEnabled();
  });

  it("клик по чекбоксу переключает checked ноды false→true", async () => {
    let ed: Editor | null = null;
    render(<Harness doc={taskDoc(false)} onReady={(e) => { ed = e; }} />);
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(itemChecked(ed as unknown as Editor)).toBe(true);
  });

  it("клик по отмеченному чекбоксу снимает галочку true→false", async () => {
    let ed: Editor | null = null;
    render(<Harness doc={taskDoc(true)} onReady={(e) => { ed = e; }} />);
    const checkbox = await screen.findByRole("checkbox");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    expect(itemChecked(ed as unknown as Editor)).toBe(false);
  });
});

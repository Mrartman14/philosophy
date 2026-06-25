// Клавиатурное редактирование списков (Enter/Tab/Shift-Tab/Backspace) поверх
// кастомных нод list/list_item. Без этих биндингов Enter штатно делал splitBlock
// и плодил второй <p> ВНУТРИ того же <li> (баг: «буллет на первом абзаце, дальше
// отступ»). Тест поднимает реальный headless-редактор и диспатчит клавиши.
import { Editor } from "@tiptap/core";
import { describe, it, expect, afterEach } from "vitest";

import type { SchemaSnapshot } from "../../types";
import { buildExtensions } from "../index";

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

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

interface PMJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMJson[];
  text?: string;
}

function makeEditor(content: PMJson): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: buildExtensions({ snapshot: fullSnapshot, context: "document" }),
    content,
  });
  return editor;
}

function press(ed: Editor, key: string, opts: { shift?: boolean } = {}): void {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey: opts.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  ed.view.dom.dispatchEvent(event);
}

function listItem(text: string, attrs?: Record<string, unknown>): PMJson {
  return {
    type: "list_item",
    ...(attrs ? { attrs } : {}),
    content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
  };
}

function bulletList(...items: PMJson[]): PMJson {
  return { type: "doc", content: [{ type: "list", attrs: { ordered: false }, content: items }] };
}

/** Узлы list_item первого списка в документе. */
function items(ed: Editor): PMJson[] {
  const doc = ed.getJSON() as PMJson;
  const list = doc.content?.[0];
  return list?.content ?? [];
}

/** Каретка в начало текста пункта №index первого списка. */
function caretAtStartOfItem(ed: Editor, index: number): void {
  let target = -1;
  let seen = -1;
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === "list_item") {
      seen++;
      if (seen === index) target = pos + 2; // +1 в li, +1 в paragraph → начало текста
    }
    return true;
  });
  ed.commands.setTextSelection(target);
}

function jsonStr(ed: Editor): string {
  return JSON.stringify(ed.getJSON());
}

describe("Клавиатура списков", () => {
  it("Enter в конце пункта создаёт НОВЫЙ пункт (а не второй абзац внутри того же)", () => {
    const ed = makeEditor(bulletList(listItem("раз")));
    ed.commands.focus("end");
    press(ed, "Enter");

    const its = items(ed);
    expect(its).toHaveLength(2);
    // Каждый пункт — ровно один paragraph (а не два абзаца в одном li).
    expect(its[0]?.content?.filter((n) => n.type === "paragraph")).toHaveLength(1);
    expect(its[1]?.content?.filter((n) => n.type === "paragraph")).toHaveLength(1);
  });

  it("Enter на ПУСТОМ пункте выходит из списка (lift)", () => {
    const ed = makeEditor(bulletList(listItem("раз"), listItem("")));
    ed.commands.focus("end"); // каретка в пустом втором пункте
    press(ed, "Enter");

    // Второй (пустой) пункт вылифтился из списка → в списке остался один пункт,
    // а на верхнем уровне документа появился параграф.
    expect(items(ed)).toHaveLength(1);
    const top = (ed.getJSON() as PMJson).content ?? [];
    expect(top.some((n) => n.type === "paragraph")).toBe(true);
  });

  it("Tab вкладывает пункт в предыдущий (sink)", () => {
    const ed = makeEditor(bulletList(listItem("раз"), listItem("два")));
    ed.commands.focus("end"); // во втором пункте
    press(ed, "Tab");

    const its = items(ed);
    // Верхний список теперь содержит ОДИН пункт, внутри которого вложенный список.
    expect(its).toHaveLength(1);
    const nested = its[0]?.content?.find((n) => n.type === "list");
    expect(nested).toBeDefined();
    expect(nested?.content).toHaveLength(1);
  });

  it("Shift-Tab развложивает вложенный пункт (lift)", () => {
    const nested: PMJson = {
      type: "doc",
      content: [
        {
          type: "list",
          attrs: { ordered: false },
          content: [
            {
              type: "list_item",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "раз" }] },
                { type: "list", attrs: { ordered: false }, content: [listItem("два")] },
              ],
            },
          ],
        },
      ],
    };
    const ed = makeEditor(nested);
    ed.commands.focus("end"); // во вложенном «два»
    press(ed, "Tab", { shift: true });

    // «два» поднялся на верхний уровень списка → два пункта верхнего уровня.
    expect(items(ed)).toHaveLength(2);
  });

  it("Enter на пункте-задаче создаёт новую задачу (checked=false, не выполнено)", () => {
    const ed = makeEditor(bulletList(listItem("сделать", { checked: false })));
    ed.commands.focus("end");
    press(ed, "Enter");

    const its = items(ed);
    expect(its).toHaveLength(2);
    expect(its[1]?.attrs?.checked).toBe(false);
  });

  it("Enter на ВЫПОЛНЕННОЙ задаче создаёт НЕвыполненную задачу", () => {
    const ed = makeEditor(bulletList(listItem("готово", { checked: true })));
    ed.commands.focus("end");
    press(ed, "Enter");

    const its = items(ed);
    expect(its).toHaveLength(2);
    expect(its[1]?.attrs?.checked).toBe(false);
  });

  // Регресс: Backspace в начале НЕ-первого пункта должен СЛИВАТЬ его с предыдущим
  // (буллет уходит, текст мёржится в список), а не ВЫКИДЫВАТЬ пункт из списка
  // отдельным параграфом. Баг был: кастомный liftAtStart выкидывал пункт наружу.
  it("Backspace в начале 2-го пункта сливает его в список (не выкидывает наружу)", () => {
    const ed = makeEditor(bulletList(listItem("раз"), listItem("два")));
    caretAtStartOfItem(ed, 1); // каретка в начале «два»
    press(ed, "Backspace");

    // «два» осталось ВНУТРИ списка (слилось), а не стало топ-уровневым параграфом.
    const doc = ed.getJSON() as PMJson;
    const firstList = doc.content?.find((n) => n.type === "list");
    expect(firstList).toBeDefined();
    expect(JSON.stringify(firstList)).toContain("два");
    // Нет отдельного list-пункта «два», выкинутого наружу как top-level paragraph.
    const topParas = (doc.content ?? []).filter((n) => n.type === "paragraph");
    expect(topParas.some((p) => JSON.stringify(p).includes("два"))).toBe(false);
  });

  it("Backspace в начале первого пункта выводит его из списка (outdent)", () => {
    const ed = makeEditor(bulletList(listItem("раз"), listItem("два")));
    caretAtStartOfItem(ed, 0);
    press(ed, "Backspace");

    // «раз» вышел на верхний уровень как параграф; «два» остался в списке.
    const doc = ed.getJSON() as PMJson;
    const topParas = (doc.content ?? []).filter((n) => n.type === "paragraph");
    expect(topParas.some((p) => JSON.stringify(p).includes("раз"))).toBe(true);
    expect(jsonStr(ed)).toContain("два");
  });
});

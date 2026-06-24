import { getSchema } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { describe, it, expect } from "vitest";

import type { SchemaSnapshot } from "../types";

import { buildExtensions } from "./index";

/**
 * EDITOR-only PER-MEDIUM ROUND-TRIP OVERLAYS в СЕРИАЛИЗОВАННОМ DOM.
 *
 * Структурную базу node/mark→DOM редактор делегирует единой карте
 * (`MARK_MAP`/`NODE_MAP`), но СВЕРХУ накладывает атрибуты, которые карта
 * НАМЕРЕННО не несёт (они нужны только редактору для round-trip parseHTML и
 * не должны течь в read/AST). edit-read-parity карвирует их как «законную
 * дивергенцию» и ИХ НЕ СВЕРЯЕТ — поэтому здесь, отдельно, проверяем, что
 * оверлеи реально доживают до финального DOM `DOMSerializer.serializeNode`:
 *   • heading attrs.id            → data-heading-id на <h{level}>
 *   • link mark title             → title на <a>
 *   • nav-ref полные anchor-attrs → id/start_block_id/… выживают на <a>
 *   • nav-ref пустой id           → фолбэк <span> с data-mark/class
 *   • table blockId               → data-block-id на <table>
 *
 * Если кто-то «упростит» renderHTML и уронит наложение оверлея — round-trip
 * (правка → сохранение → перезагрузка) молча потеряет данные; этот тест ловит.
 */

const fullSnapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "heading", "table"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: {
    maxDepth: 32,
    maxTextLen: 1_000_000,
    maxContentItems: 10_000,
    maxMarksPerNode: 100,
  },
  urlPolicy: { dangerousSchemes: [] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

const extensions = buildExtensions({ snapshot: fullSnapshot, context: "document" });
const schema = getSchema(extensions);
const serializer = DOMSerializer.fromSchema(schema);

/** serializeNode → первый корневой элемент DOM. */
function serializeToElement(node: Parameters<typeof serializer.serializeNode>[0]): Element {
  const dom = serializer.serializeNode(node);
  const wrap = document.createElement("div");
  wrap.appendChild(dom);
  const el = wrap.firstElementChild;
  if (el === null) throw new Error("сериализация не дала корневого элемента");
  return el;
}

describe("editor round-trip-оверлеи в сериализованном DOM", () => {
  it("heading attrs.id → data-heading-id на <h{level}>", () => {
    const heading = schema.nodes.heading;
    if (!heading) throw new Error("schema.nodes.heading не зарегистрирован");
    const node = heading.createChecked(
      { level: 2, id: "intro", blockId: "h-1" },
      schema.text("Заголовок"),
    );
    const el = serializeToElement(node);
    expect(el.tagName.toLowerCase()).toBe("h2");
    expect(el.getAttribute("data-heading-id")).toBe("intro");
    // структурная база карты тоже на месте (sanity).
    expect(el.getAttribute("data-block-id")).toBe("h-1");
  });

  it("heading без id → НЕТ data-heading-id (оверлей не шумит)", () => {
    const heading = schema.nodes.heading;
    if (!heading) throw new Error("schema.nodes.heading не зарегистрирован");
    const node = heading.createChecked({ level: 3, blockId: "h-2" }, schema.text("Без id"));
    const el = serializeToElement(node);
    expect(el.tagName.toLowerCase()).toBe("h3");
    expect(el.hasAttribute("data-heading-id")).toBe(false);
  });

  it("link mark title → title на <a> (структурный href от карты)", () => {
    const link = schema.marks.link;
    const para = schema.nodes.paragraph;
    if (!link || !para) throw new Error("link/paragraph не зарегистрированы");
    const text = schema.text("ссылка", [
      link.create({ href: "https://example.com", title: "подсказка" }),
    ]);
    const p = para.createChecked(null, text);
    const a = serializeToElement(p).querySelector("a");
    expect(a).not.toBeNull();
    if (a === null) throw new Error("<a> не найден");
    expect(a.getAttribute("href")).toBe("https://example.com");
    expect(a.getAttribute("title")).toBe("подсказка"); // editor-only оверлей
  });

  it("nav-ref полные anchor-attrs выживают на <a> + структурная база карты", () => {
    const gref = schema.marks.glossary_ref;
    const para = schema.nodes.paragraph;
    if (!gref || !para) throw new Error("glossary_ref/paragraph не зарегистрированы");
    const text = schema.text("термин", [
      gref.create({
        id: "22222222-2222-2222-2222-222222222222",
        start_block_id: "b-1",
        start_char: 0,
        end_block_id: "b-1",
        end_char: 6,
        exact: "термин",
      }),
    ]);
    const p = para.createChecked(null, text);
    const a = serializeToElement(p).querySelector("a");
    expect(a).not.toBeNull();
    if (a === null) throw new Error("<a> не найден");
    // структурная база из карты (href из id, data-mark, class).
    expect(a.getAttribute("href")).toBe("/glossary/22222222-2222-2222-2222-222222222222");
    expect(a.getAttribute("data-mark")).toBe("glossary_ref");
    expect(a.getAttribute("class")).toBe("nav-ref nav-ref--glossary_ref");
    // editor-only round-trip anchor-attrs выживают для parseHTML.
    expect(a.getAttribute("id")).toBe("22222222-2222-2222-2222-222222222222");
    expect(a.getAttribute("start_block_id")).toBe("b-1");
    expect(a.getAttribute("start_char")).toBe("0");
    expect(a.getAttribute("end_block_id")).toBe("b-1");
    expect(a.getAttribute("end_char")).toBe("6");
    expect(a.getAttribute("exact")).toBe("термин");
  });

  it("nav-ref пустой id → фолбэк <span> с data-mark/class (карта вернула null)", () => {
    const gref = schema.marks.glossary_ref;
    const para = schema.nodes.paragraph;
    if (!gref || !para) throw new Error("glossary_ref/paragraph не зарегистрированы");
    const text = schema.text("черновик", [gref.create({ id: "" })]);
    const p = para.createChecked(null, text);
    const root = serializeToElement(p);
    expect(root.querySelector("a")).toBeNull(); // НЕ <a> — id пуст
    const span = root.querySelector('span[data-mark="glossary_ref"]');
    expect(span).not.toBeNull();
    if (span === null) throw new Error("<span> фолбэк не найден");
    expect(span.getAttribute("data-mark")).toBe("glossary_ref");
    expect(span.getAttribute("class")).toBe("nav-ref nav-ref--glossary_ref");
  });

  it("table blockId → data-block-id на <table> (оверлей через HTMLAttributes)", () => {
    const table = schema.nodes.table;
    const row = schema.nodes.table_row;
    const cell = schema.nodes.table_cell;
    if (!table || !row || !cell) throw new Error("table/row/cell не зарегистрированы");
    const node = table.createChecked(
      { blockId: "tbl-1" },
      row.createChecked(null, cell.createChecked(null, schema.text("ячейка"))),
    );
    const el = serializeToElement(node);
    expect(el.tagName.toLowerCase()).toBe("table");
    expect(el.getAttribute("data-block-id")).toBe("tbl-1"); // editor-only round-trip
  });
});

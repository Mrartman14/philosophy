import { getSchema } from "@tiptap/core";
import { Node as PMNode, DOMSerializer } from "@tiptap/pm/model";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import {
  fixtureParagraph,
  fixtureHeading,
  fixtureBlockquote,
  fixtureCodeBlock,
  fixtureBulletList,
  fixtureOrderedList,
  fixtureTaskList,
  fixtureThematicBreak,
} from "@/components/ast-editor/__fixtures__/sample-blocks";
import { deserialize } from "@/components/ast-editor/deserializer";
import { buildExtensions } from "@/components/ast-editor/extensions";
import type { AstBlock, SchemaSnapshot } from "@/components/ast-editor/types";
import { AstRender } from "@/components/ast-render";

import { must } from "./test-support";

/**
 * EDIT↔READ СТРУКТУРНЫЙ ПАРИТЕТ — центральная гарантия рефактора node→DOM.
 *
 * И read-рендер (`AstRender`), и `renderHTML` редактора теперь выводят DOM из
 * ОДНОЙ нейтральной карты (`@/components/ast-content-map`). Этот тест прогоняет
 * один и тот же AST-фикстур через ОБА РЕАЛЬНЫХ конвейера и сверяет общую
 * структурную базу — НЕ повторный вызов карты (это была бы тавтология: оба
 * пути зовут одну функцию), а:
 *   • READ: `renderToStaticMarkup(<AstRender>)` → парс в DOM (реальный React-рендер);
 *   • EDIT: deserialize(AST) → PM-схема (`buildExtensions`→`getSchema`) →
 *     `Node.fromJSON` → `DOMSerializer.serializeNode` (реальный ProseMirror).
 *
 * ПОЧЕМУ ЭТО ЛОВИТ ДРЕЙФ: если будущая правка заставит editor-`renderHTML` или
 * read-адаптер пост-обрабатывать структурную базу карты по-разному (напр. read
 * перестанет вешать data-block-id, edit поменяет tag, кто-то «улучшит» обёртку),
 * этот тест упадёт — расхождение проявляется именно в финальном DOM каждого медиума,
 * а не в общем источнике.
 *
 * СВЕРЯЕМ (общая база): tag-имя + общие структурные атрибуты —
 *   data-block-id, data-language (code_block), data-list (list), data-align
 *   (cell), data-header (row).
 * НАМЕРЕННО ИГНОРИРУЕМ задокументированные per-medium расхождения (НЕ ассертим):
 *   • READ-only: id заголовка (scroll-spy/TOC), header-ячейки апгрейдятся до
 *     <th scope=col> (edit оставляет <td>), резолв URL картинки.
 *   • EDIT-only: data-heading-id, round-trip attrs nav-ref, data-storage-key.
 * Поэтому header-строка таблицы вынесена в ОТДЕЛЬНЫЙ тест, где дивергенция
 * td(edit)↔th(read) проверяется ЯВНО; в общем walk сверяются только тело-ячейки.
 */

// Тот же снапшот, что в pm-schema.test.ts: «full»-контекст со всеми shared-блоками.
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

const extensions = buildExtensions({ snapshot: fullSnapshot, context: "document" });
const schema = getSchema(extensions);

// Только текстовая таблица БЕЗ header-строки: header-ячейки td↔th — это
// задокументированная дивергенция (см. отдельный тест ниже).
const fixtureBodyTable: AstBlock = {
  id: "tbl-body",
  type: "table",
  position: 0,
  content: [
    {
      type: "table_row",
      content: [
        { type: "table_cell", attrs: { align: "center" }, content: [{ type: "text", text: "ячейка" }] },
      ],
    },
  ],
  text: "ячейка",
};

/** Общие структурные атрибуты, которые ОБЯЗАНЫ совпадать в edit и read. */
const SHARED_ATTRS = ["data-block-id", "data-language", "data-list", "data-align", "data-header"] as const;

/** READ: реальный React-рендер AstRender → первый корневой элемент DOM. */
function readElement(block: AstBlock): Element {
  const wrap = document.createElement("div");
  // renderToStaticMarkup инлайнится прямо в innerHTML: именованный результат
  // ложно матчит testing-library/render-result-naming-convention (эвристика по
  // «render» в имени вызова), хотя это статический SSR-маркап, а не RTL render().
  wrap.innerHTML = renderToStaticMarkup(createElement(AstRender, { blocks: [block] }));
  return must(wrap.firstElementChild);
}

/** EDIT: AST → PM-схема → DOMSerializer → первый корневой элемент DOM. */
function editElement(block: AstBlock): Element {
  const pmJson = deserialize([block], fullSnapshot);
  const doc = PMNode.fromJSON(schema, pmJson);
  doc.check();
  const node = doc.child(0); // единственный блок документа
  const dom = DOMSerializer.fromSchema(schema).serializeNode(node);
  const wrap = document.createElement("div");
  wrap.appendChild(dom);
  return must(wrap.firstElementChild);
}

/**
 * Снимок только общей базы узла: tag + SHARED_ATTRS (значение или null).
 *
 * ИСКЛЮЧЕНИЕ <table>: data-block-id на самом <table> — EDIT-only round-trip
 * атрибут. В редакторе table — верхнеуровневый Block и хранит blockId (table.ts
 * накладывает его через HTMLAttributes), а READ-карта (`NODE_MAP.table`)
 * НАМЕРЕННО не несёт data-block-id (контракт субстрата аннотаций: строки/ячейки
 * без id → мусорный якорь, см. block-renderer.test.tsx). Это задокументированная
 * дивергенция — исключаем data-block-id из сверки ИМЕННО для <table>.
 */
function structuralSignature(el: Element): Record<string, string | null> {
  const tag = el.tagName.toLowerCase();
  const sig: Record<string, string | null> = { tag };
  for (const name of SHARED_ATTRS) {
    if (tag === "table" && name === "data-block-id") continue;
    sig[name] = el.getAttribute(name);
  }
  return sig;
}

/**
 * Рекурсивный walk обоих деревьев: на каждом узле сверяет structuralSignature и
 * число дочерних элементов, затем спускается попарно. Падает с понятным путём.
 */
function expectStructuralParity(edit: Element, read: Element, path: string): void {
  expect(structuralSignature(read), `READ-сигнатура @ ${path}`).toEqual(structuralSignature(edit));

  const editKids = Array.from(edit.children);
  const readKids = Array.from(read.children);
  expect(readKids.length, `число дочерних элементов @ ${path} (${edit.tagName})`).toBe(editKids.length);

  for (let i = 0; i < editKids.length; i++) {
    expectStructuralParity(must(editKids[i]), must(readKids[i]), `${path} > ${edit.tagName.toLowerCase()}[${i}]`);
  }
}

// Shared node-типы (по одному представительному фикстуру на каждый), БЕЗ header-таблицы.
const cases: [string, AstBlock][] = [
  ["paragraph", fixtureParagraph],
  ["heading", fixtureHeading],
  ["blockquote (> вложенный paragraph)", fixtureBlockquote],
  ["code_block (data-language)", fixtureCodeBlock],
  ["thematic_break", fixtureThematicBreak],
  ["bullet list (ul + list_item)", fixtureBulletList],
  ["ordered list (ol + list_item)", fixtureOrderedList],
  ["task list (list_item data-checked не входит в shared)", fixtureTaskList],
  ["table тело (tbody > tr > td data-align)", fixtureBodyTable],
];

describe("EDIT↔READ структурный паритет node→DOM (реальные конвейеры)", () => {
  for (const [name, block] of cases) {
    it(`общая база совпадает: ${name}`, () => {
      const edit = editElement(block);
      const read = readElement(block);
      // Видимый top-level assert (корневой tag — главное утверждение паритета);
      // expectStructuralParity делает глубокий рекурсивный walk общей базы.
      expect(read.tagName.toLowerCase()).toBe(edit.tagName.toLowerCase());
      expectStructuralParity(edit, read, "root");
    });
  }

  // Задокументированная ЗАКОННАЯ дивергенция: header-ячейка апгрейдится до
  // <th scope=col> ТОЛЬКО в read (per-node renderHTML редактора не знает родителя
  // → остаётся <td>). data-align при этом совпадает. Проверяем явно, а не «оба td».
  it("header-ячейка: edit=<td>, read=<th scope=col> (известное расхождение, data-align совпадает)", () => {
    const headerTable: AstBlock = {
      id: "tbl-head",
      type: "table",
      position: 0,
      content: [
        {
          type: "table_row",
          attrs: { header: true },
          content: [
            { type: "table_cell", attrs: { align: "left" }, content: [{ type: "text", text: "колонка" }] },
          ],
        },
      ],
      text: "колонка",
    };

    const editRow = must(must(editElement(headerTable).firstElementChild).firstElementChild); // tbody > tr
    const readRow = must(must(readElement(headerTable).firstElementChild).firstElementChild);

    // data-header на строке совпадает (общая база).
    expect(readRow.getAttribute("data-header")).toBe(editRow.getAttribute("data-header"));

    const editCell = must(editRow.firstElementChild);
    const readCell = must(readRow.firstElementChild);

    expect(editCell.tagName.toLowerCase()).toBe("td"); // edit НЕ апгрейдит
    expect(readCell.tagName.toLowerCase()).toBe("th"); // read апгрейдит
    expect(readCell.getAttribute("scope")).toBe("col"); // read-only семантика
    // но общий структурный атрибут data-align идентичен в обоих медиумах.
    expect(readCell.getAttribute("data-align")).toBe(editCell.getAttribute("data-align"));
    expect(readCell.getAttribute("data-align")).toBe("left");
  });
});

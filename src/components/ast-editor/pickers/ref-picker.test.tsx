import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru
// с простой ICU-подстановкой `{arg}` (зеркалит реальный next-intl: крошка
// `refLectureCrumb` = "Лекция: {title}" подставляет title).
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string, args?: Record<string, unknown>) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") {
          // Отсутствующий ключ: возвращаем сам ключ (для тестов достаточно).
          return key;
        }
        // Подстановка ICU-аргументов `{name}` → значение из args.
        return args
          ? val.replace(/\{(\w+)\}/g, (m: string, name: string) =>
              name in args ? String(args[name]) : m,
            )
          : val;
      };
    },
  };
});

vi.mock("./actions", () => ({
  searchLectures: vi.fn(),
  searchGlossary: vi.fn(),
  searchDocuments: vi.fn(),
  searchMedia: vi.fn(),
  searchCanvases: vi.fn(),
  searchCommentsByLecture: vi.fn(),
}));

import { buildExtensions } from "../extensions";
import type { SchemaSnapshot } from "../types";

import * as actions from "./actions";
import { RefPicker } from "./ref-picker";

const mocked = actions as unknown as {
  searchGlossary: ReturnType<typeof vi.fn>;
  searchLectures: ReturnType<typeof vi.fn>;
  searchDocuments: ReturnType<typeof vi.fn>;
  searchCommentsByLecture: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph"] },
  entityBlockLimits: { full: 100 },
  entityContexts: { document: "full" },
  limits: { maxDepth: 32, maxTextLen: 100_000, maxContentItems: 1000, maxMarksPerNode: 100 },
  urlPolicy: { dangerousSchemes: ["javascript", "data", "vbscript"] },
  nodes: new Map(),
  marks: new Map(),
  exclusiveCategories: [],
};

function makeEditor() {
  return new Editor({
    extensions: buildExtensions({ snapshot, context: "document" }),
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

describe("RefPicker", () => {
  it("по умолчанию активна категория Термин и ищет глоссарий", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
    expect(await screen.findByText("Бытие")).toBeInTheDocument();
    expect(mocked.searchGlossary).toHaveBeenCalled();
    editor.destroy();
  });

  it("вставляет glossary_ref по выбору и зовёт onWillInsert", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    const onWillInsert = vi.fn();
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} onWillInsert={onWillInsert} />);
    fireEvent.click(await screen.findByText("Бытие"));
    expect(onWillInsert).toHaveBeenCalled();
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"type":"glossary_ref"');
    expect(json).toContain('"id":"g1"');
    editor.destroy();
  });

  it("терминальный выбор закрывает попап (onOpenChange(false))", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    const onOpenChange = vi.fn();
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={onOpenChange} />);
    fireEvent.click(await screen.findByText("Бытие"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    editor.destroy();
  });

  it("клик по категории не закрывает попап и не считается выбором item", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    mocked.searchLectures.mockResolvedValue({ data: [{ id: "L1", title: "Онтология" }], total: 1 });
    const onOpenChange = vi.fn();
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={onOpenChange} />);
    await screen.findByText("Бытие");
    fireEvent.click(screen.getByRole("button", { name: "Документ" }));
    // Переключение категории не должно закрыть попап и не вставить ничего.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(JSON.stringify(editor.getJSON())).not.toContain('"_ref"');
    editor.destroy();
  });

  it("комментарий: сперва лекция, затем комментарий лекции (drill-in)", async () => {
    mocked.searchLectures.mockResolvedValue({ data: [{ id: "L1", title: "Онтология" }], total: 1 });
    mocked.searchCommentsByLecture.mockResolvedValue({ data: [{ id: "c1", snippet: "А что если" }], total: 1 });
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Комментарий" }));
    fireEvent.click(await screen.findByText("Онтология")); // выбор лекции = drill-in
    expect(await screen.findByText(/Онтология/)).toBeInTheDocument(); // крошка
    fireEvent.click(await screen.findByText("А что если")); // выбор комментария
    expect(JSON.stringify(editor.getJSON())).toContain('"type":"comment_ref"');
    expect(mocked.searchCommentsByLecture).toHaveBeenCalledWith("L1", "", 0, 20);
    editor.destroy();
  });

  it("defaultLectureId префиллит шаг 2 (сразу комментарии)", async () => {
    mocked.searchCommentsByLecture.mockResolvedValue({ data: [{ id: "c1", snippet: "Реплика" }], total: 1 });
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} defaultLectureId="L9" />);
    fireEvent.click(screen.getByRole("button", { name: "Комментарий" }));
    expect(await screen.findByText("Реплика")).toBeInTheDocument();
    expect(mocked.searchCommentsByLecture).toHaveBeenCalledWith("L9", "", 0, 20);
    editor.destroy();
  });

  it("элемент с пустым id отфильтрован, клик по нему НЕ вставляет dead-ref", async () => {
    // Бэк отдал «битый» элемент без id (dead-reference): он отфильтрован из
    // видимого списка (нет кликабельной опции), а если бы значение всё же дошло
    // до insertRef — гард по пустому id не вставляет марку и закрывает попап.
    mocked.searchGlossary.mockResolvedValue({
      data: [{ id: "", title: "Безымянный" }, { id: "g2", title: "Сущее" }],
      total: 2,
    });
    const onOpenChange = vi.fn();
    const onWillInsert = vi.fn();
    const editor = makeEditor();
    render(
      <RefPicker editor={editor} open onOpenChange={onOpenChange} onWillInsert={onWillInsert} />,
    );
    // Валидный элемент виден, битый — нет (отфильтрован).
    await screen.findByText("Сущее");
    expect(screen.queryByText("Безымянный")).not.toBeInTheDocument();
    // Клик по битому невозможен (его нет в DOM); пробуем по тексту — ничего не
    // вставляется и onWillInsert не вызывается.
    fireEvent.click(screen.getByText("Сущее")); // валидный → вставит g2 (контроль)
    const json = JSON.stringify(editor.getJSON());
    expect(json).toContain('"id":"g2"');
    expect(json).not.toContain('"id":""');
    editor.destroy();
  });

  it("гард insertRef: id-less item не рендерится как опция и не даёт *_ref", async () => {
    // Единственный элемент с id:"" → отфильтрован из видимого списка: нет опции
    // для клика, в JSON нет *_ref-марки, onWillInsert не вызван. Если бы значение
    // всё же дошло до insertRef — гард по пустому id закрыл бы попап без вставки.
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "", title: "Призрак" }], total: 1 });
    const onOpenChange = vi.fn();
    const onWillInsert = vi.fn();
    const editor = makeEditor();
    render(
      <RefPicker editor={editor} open onOpenChange={onOpenChange} onWillInsert={onWillInsert} />,
    );
    await screen.findByRole("combobox");
    await waitFor(() => { expect(mocked.searchGlossary).toHaveBeenCalled(); });
    // Битый элемент не показан как опция.
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.queryByText("Призрак")).not.toBeInTheDocument();
    expect(JSON.stringify(editor.getJSON())).not.toContain("_ref");
    expect(onWillInsert).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("Popup имеет доступное имя (aria-label «Вставить ссылку»)", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
    await screen.findByText("Бытие");
    expect(screen.getByRole("dialog", { name: "Вставить ссылку" })).toBeInTheDocument();
    editor.destroy();
  });

  it("после смены категории фокус возвращается в поле поиска", async () => {
    mocked.searchGlossary.mockResolvedValue({ data: [{ id: "g1", title: "Бытие" }], total: 1 });
    mocked.searchDocuments.mockResolvedValue({ data: [{ id: "d1", filename: "essay.pdf" }], total: 1 });
    const editor = makeEditor();
    render(<RefPicker editor={editor} open onOpenChange={() => undefined} />);
    await screen.findByText("Бытие");
    fireEvent.click(screen.getByRole("button", { name: "Документ" }));
    await screen.findByText("essay.pdf");
    // key={scopeKey} ремоунтит Root — фокус не должен утечь на <body>; эффект на
    // scopeKey возвращает его в поле поиска (combobox-input).
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("combobox"));
    });
    expect(document.activeElement).not.toBe(document.body);
    editor.destroy();
  });
});

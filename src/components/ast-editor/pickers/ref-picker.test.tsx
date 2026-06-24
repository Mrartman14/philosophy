import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
// Ключи refCategoryAriaLabel / refLectureCrumb добавляются в Task 12 — пока их
// нет в каталоге, и переводчик вернёт сам ключ (этого достаточно для тестов).
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
        if (typeof val === "string") return val;
        // Отсутствующий ключ (напр. refLectureCrumb / refCategoryAriaLabel — их
        // добавит Task 12): возвращаем ключ + значения аргументов, чтобы крошка
        // несла подставленный title (как сделает реальный ICU-перевод).
        const suffix = args ? ` ${Object.values(args).filter((v) => v !== "").join(" ")}` : "";
        return `${key}${suffix}`.trimEnd();
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
});

// src/components/ast-editor/toolbar/buttons/image-button.test.tsx
import "@testing-library/jest-dom/vitest";
import { Toolbar } from "@base-ui/react/toolbar";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { describe, it, expect, vi, afterEach } from "vitest";

import { buildExtensions } from "../../extensions";
import type { SchemaSnapshot } from "../../types";
import { makePngFile } from "../../upload/__fixtures__/png-1x1";
import { uploadImage } from "../../upload/upload-image";

import { ImageButton } from "./image-button";

// vi.mock поднимается выше всех объявлений файла — внешние переменные внутри
// фабрики допустимы только через vi.hoisted, иначе ReferenceError.
const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }));
vi.mock("@/components/ui", () => ({
  useToast: () => ({ add: toastAdd }),
}));
vi.mock("../../upload/upload-image", () => ({
  uploadImage: vi.fn(),
}));
// Мок i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: editor } = await import("@/i18n/messages/ru/editor");
  return {
    useT: (ns: string) => {
      const catalog = ns === "editor" ? editor : {};
      return (key: string) => {
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of key.split(".")) { val = val?.[part]; }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        return typeof val === "string" ? val : key;
      };
    },
  };
});

const mockedUpload = uploadImage as unknown as ReturnType<typeof vi.fn>;

// 64-hex — как настоящий sha256 storage_key с бека.
const KEY = "a1b2c3d4".repeat(8);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const snapshot: SchemaSnapshot = {
  blockLevels: { full: ["paragraph", "image"], basic: ["paragraph"] },
  entityBlockLimits: { full: 100, basic: 100 },
  entityContexts: { document: "full", comment: "basic" },
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

describe("ImageButton", () => {
  it("загружает выбранный файл и вставляет image-блок со storage_key", async () => {
    mockedUpload.mockResolvedValue({
      success: true,
      data: { storage_key: KEY, upload_id: "u-1" },
    });
    const editor = makeEditor();
    // Toolbar.Button требует контекст Toolbar.Root (Base UI).
    const { container } = render(
      <Toolbar.Root>
        <ImageButton editor={editor} schema={snapshot} context="document" />
      </Toolbar.Root>,
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    if (input === null) throw new Error("file input не найден");
    fireEvent.change(input, { target: { files: [makePngFile()] } });

    await waitFor(() => {
      expect(JSON.stringify(editor.getJSON())).toContain(KEY);
    });
    expect(mockedUpload).toHaveBeenCalledOnce();
    expect(toastAdd).not.toHaveBeenCalled();
    editor.destroy();
  });

  it("ошибка загрузки → toast, блок не вставляется", async () => {
    mockedUpload.mockResolvedValue({
      success: false,
      error: "Изображение слишком большое (макс 10 MiB)",
      code: "image_too_large",
    });
    const editor = makeEditor();
    // Toolbar.Button требует контекст Toolbar.Root (Base UI).
    const { container } = render(
      <Toolbar.Root>
        <ImageButton editor={editor} schema={snapshot} context="document" />
      </Toolbar.Root>,
    );

    const fileInput2 = container.querySelector('input[type="file"]');
    if (fileInput2 === null) throw new Error("file input не найден");
    fireEvent.change(fileInput2, {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => { expect(toastAdd).toHaveBeenCalledOnce(); });
    expect(JSON.stringify(editor.getJSON())).not.toContain('"type":"image"');
    editor.destroy();
  });

  it("reject транспорта (uploadImage кидает) → generic-toast, без unhandled rejection", async () => {
    mockedUpload.mockRejectedValue(new Error("network down"));
    const editor = makeEditor();
    // Toolbar.Button требует контекст Toolbar.Root (Base UI).
    const { container } = render(
      <Toolbar.Root>
        <ImageButton editor={editor} schema={snapshot} context="document" />
      </Toolbar.Root>,
    );

    const fileInput3 = container.querySelector('input[type="file"]');
    if (fileInput3 === null) throw new Error("file input не найден");
    fireEvent.change(fileInput3, {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => { expect(toastAdd).toHaveBeenCalledOnce(); });
    const call3 = toastAdd.mock.calls[0];
    if (call3 === undefined) throw new Error("toastAdd не был вызван");
    const arg3 = call3[0] as { title?: string };
    expect(arg3.title).toMatch(/не удалось загрузить/i);
    expect(JSON.stringify(editor.getJSON())).not.toContain('"type":"image"');
    // Кнопка разблокирована (busy сброшен в finally).
    expect(screen.getByLabelText(/изображение/i)).not.toBeDisabled();
    editor.destroy();
  });

  it("код forbidden → branded-текст в toast", async () => {
    mockedUpload.mockResolvedValue({
      success: false,
      error: "raw backend error",
      code: "forbidden",
    });
    const editor = makeEditor();
    // Toolbar.Button требует контекст Toolbar.Root (Base UI).
    const { container } = render(
      <Toolbar.Root>
        <ImageButton editor={editor} schema={snapshot} context="document" />
      </Toolbar.Root>,
    );

    const fileInput4 = container.querySelector('input[type="file"]');
    if (fileInput4 === null) throw new Error("file input не найден");
    fireEvent.change(fileInput4, {
      target: { files: [makePngFile()] },
    });

    await waitFor(() => { expect(toastAdd).toHaveBeenCalledOnce(); });
    const call4 = toastAdd.mock.calls[0];
    if (call4 === undefined) throw new Error("toastAdd не был вызван");
    const arg4 = call4[0] as { description?: string };
    expect(arg4.description).toMatch(/нет прав/i);
    editor.destroy();
  });

  it("не рендерится, если image не разрешён в контексте (comment/basic)", () => {
    const editor = makeEditor();
    render(
      <Toolbar.Root>
        <ImageButton editor={editor} schema={snapshot} context="comment" />
      </Toolbar.Root>,
    );
    expect(screen.queryByLabelText(/изображение/i)).toBeNull();
    editor.destroy();
  });
});

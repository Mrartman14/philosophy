import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

// Захватываем FormData, которую получает server action из реальной формы
// (реальные Base UI Form/Field + ручной hidden-input). Редактор мокаем —
// кнопка имитирует его onChange с реальными блоками.
const captured: { fd: FormData | null } = { fd: null };

vi.mock("../actions", () => ({
  createTerm: vi.fn((_prev: unknown, fd: FormData) => {
    captured.fd = fd;
    return Promise.resolve({ success: true, data: { id: "t1" } });
  }),
}));

vi.mock("@/hooks/use-action-redirect", () => ({ useActionRedirect: vi.fn() }));
vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

vi.mock("@/components/ast-editor/lazy-ast-editor", () => ({
  LazyAstEditor: ({ onChange }: { onChange: (b: AstBlock[]) => void }) => (
    <button
      type="button"
      onClick={() => {
        onChange([
          { type: "paragraph", content: [{ type: "text", text: "test" }] },
        ] as unknown as AstBlock[]);
      }}
    >
      mock-type
    </button>
  ),
}));

import { GlossaryCreateForm } from "./glossary-create-form";

afterEach(() => { cleanup(); captured.fd = null; });

describe("GlossaryCreateForm — поток данных формы", () => {
  it("после ввода тела в Form[blocks] уходит валидный JSON с содержимым", async () => {
    render(<GlossaryCreateForm />);

    // имитируем ввод тела (onChange редактора → setBlocks → hidden input)
    fireEvent.click(screen.getByText("mock-type"));
    // сабмит
    fireEvent.click(screen.getByRole("button", { name: "createButton" }));

    await waitFor(() => { expect(captured.fd).not.toBeNull(); });
    const raw = captured.fd?.get("blocks");
    expect(typeof raw).toBe("string");
    expect(raw).not.toBe("[]");
    expect(raw).not.toBe("");
    const parsed: unknown = JSON.parse(raw as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(JSON.stringify(parsed)).toContain("test");
  });
});

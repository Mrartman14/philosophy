import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

// Захватываем FormData, которую получает server action из реальной формы
// (реальные Base UI Form/Field + ручной hidden-input). Редактор замокан —
// его toolbar-изоляцию покрывает ast-editor-field-isolation.test.tsx на РЕАЛЬНОМ
// AstEditor; здесь проверяем контракт самой формы.
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
  it("в форме РОВНО одно поле blocks (носитель — ручной hidden input)", () => {
    const { container } = render(<GlossaryCreateForm />);
    /* eslint-disable-next-line testing-library/no-container, testing-library/no-node-access */
    const blocksFields = container.querySelectorAll("[name='blocks']");
    expect(blocksFields).toHaveLength(1);
  });

  it("после ввода тела в Form[blocks] уходит валидный JSON с содержимым", async () => {
    render(<GlossaryCreateForm />);

    fireEvent.click(screen.getByText("mock-type"));
    fireEvent.click(screen.getByRole("button", { name: "createButton" }));

    await waitFor(() => { expect(captured.fd).not.toBeNull(); });
    const all = captured.fd?.getAll("blocks") ?? [];
    expect(all).toHaveLength(1);
    const raw = all[0];
    expect(typeof raw).toBe("string");
    const parsed: unknown = JSON.parse(raw as string);
    expect(Array.isArray(parsed)).toBe(true);
    expect(JSON.stringify(parsed)).toContain("test");
  });
});

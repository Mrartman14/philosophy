import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import type { CommentType } from "../types";

// Реальные Base UI Form/Field + ручной hidden-input; редактор замокан кнопкой,
// клик по которой эмулирует ввод тела (onChange отдаёт непустые blocks).
const captured: { fd: FormData | null } = { fd: null };

vi.mock("../actions", () => ({
  createComment: vi.fn((_prev: unknown, fd: FormData) => {
    captured.fd = fd;
    return Promise.resolve({ success: true, data: { id: "c1" } });
  }),
}));

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

vi.mock("./lazy-ast-editor", () => ({
  LazyAstEditor: ({ onChange }: { onChange: (b: AstBlock[]) => void }) => (
    <button
      type="button"
      data-testid="editor"
      onClick={() => {
        onChange([
          { type: "paragraph", content: [{ type: "text", text: "test" }] },
        ] as unknown as AstBlock[]);
      }}
    >
      mock-editor
    </button>
  ),
}));

import { CommentCreateForm } from "./comment-create-form";

const rootTypes: CommentType[] = ["claim"];

function blocksValue(container: HTMLElement): string {
  /* eslint-disable-next-line testing-library/no-node-access */
  const el = container.querySelector("input[name='blocks']");
  return el instanceof HTMLInputElement ? el.value : "";
}

afterEach(() => { cleanup(); captured.fd = null; });

describe("CommentCreateForm — сброс после успешного создания", () => {
  it("после успеха обнуляет blocks и ремоунтит редактор (форма «закрывается»)", async () => {
    const { container } = render(
      <CommentCreateForm lectureId="L1" rootTypes={rootTypes} />,
    );

    const editorBefore = screen.getByTestId("editor");

    // Ввод тела → hidden blocks непустой.
    fireEvent.click(editorBefore);
    expect(blocksValue(container)).toContain("test");

    // Сабмит → server action возвращает success.
    fireEvent.click(screen.getByRole("button", { name: "createSubmit" }));
    await waitFor(() => { expect(captured.fd).not.toBeNull(); });

    // Контракт сброса: blocks обнулены, редактор пересоздан (новый DOM-узел).
    await waitFor(() => { expect(blocksValue(container)).toBe("[]"); });
    expect(screen.getByTestId("editor")).not.toBe(editorBefore);
  });
});

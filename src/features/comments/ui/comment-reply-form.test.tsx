import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import type { CommentType } from "../types";

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

import { CommentReplyForm } from "./comment-reply-form";

const childTypes: CommentType[] = ["claim"];

afterEach(() => { cleanup(); captured.fd = null; });

describe("CommentReplyForm — схлопывание после успешного ответа", () => {
  it("после успеха форма убирается целиком (назад к кнопке «Ответить»)", async () => {
    render(<CommentReplyForm lectureId="L1" parentId="P1" childTypes={childTypes} />);

    // Изначально свёрнута — только кнопка раскрытия.
    fireEvent.click(screen.getByRole("button", { name: "replyButton" }));
    expect(screen.getByTestId("editor")).toBeInTheDocument();

    // Ввод тела + сабмит → success.
    fireEvent.click(screen.getByTestId("editor"));
    fireEvent.click(screen.getByRole("button", { name: "replySubmit" }));
    await waitFor(() => { expect(captured.fd).not.toBeNull(); });

    // Контракт: форма исчезла, вернулась кнопка «Ответить».
    await waitFor(() => {
      expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "replyButton" })).toBeInTheDocument();
  });
});

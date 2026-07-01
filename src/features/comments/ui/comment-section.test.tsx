// Интеграция CommentSection: deep-link ?comment= (focusCommentId) фетчит
// корневой тред и подмешивает его в начало ленты (закрывает wiring (b)).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({ getT: () => Promise.resolve((k: string) => k) }));
vi.mock("@/utils/me", () => ({ getMe: () => Promise.resolve(null) }));
vi.mock("@/components/ast-editor/schema-server", () => ({ getAstSchema: () => Promise.resolve({}) }));
vi.mock("@/components/ast-editor/schema-context", () => ({
  SchemaContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../permissions", () => ({
  canCreateComment: () => false,
  canSearchComments: () => false,
}));
vi.mock("../api", () => ({
  getCommentSchema: vi.fn(),
  getLectureComments: vi.fn(),
  getCommentThread: vi.fn(),
  searchComments: vi.fn(),
}));
vi.mock("./comment-export-links", () => ({ CommentExportLinks: () => null }));
// Стаб дерева: рендерим id корней в порядке — так проверяем и мёрж, и порядок.
vi.mock("./comment-tree", () => ({
  CommentTree: ({ subtrees }: { subtrees: { root?: { id?: string } }[] }) => (
    <ul>
      {subtrees.map((s) => (
        <li key={s.root?.id} data-testid="root">
          {s.root?.id}
        </li>
      ))}
    </ul>
  ),
}));

import { getCommentSchema, getCommentThread, getLectureComments } from "../api";

import { CommentSection } from "./comment-section";

const listOf = (...ids: string[]) => ({
  subtrees: ids.map((id) => ({ root: { id }, descendants: [] })),
  total: ids.length,
  offset: 0,
  limit: 20,
});

beforeEach(() => {
  vi.mocked(getCommentSchema).mockResolvedValue({ allowed_roots: [] } as never);
  vi.mocked(getLectureComments).mockResolvedValue(listOf("a", "b") as never);
  vi.mocked(getCommentThread).mockReset();
});

afterEach(cleanup);

describe("CommentSection — focusCommentId (deep-link)", () => {
  it("фетчит тред и препендит его корень в ленту, если он вне 1-й страницы", async () => {
    vi.mocked(getCommentThread).mockResolvedValue({ root: { id: "z" }, descendants: [] } as never);

    render(await CommentSection({ lectureId: "lec-1", focusCommentId: "cmt-9" }));

    expect(getCommentThread).toHaveBeenCalledWith("cmt-9");
    const ids = screen.getAllByTestId("root").map((el) => el.textContent);
    expect(ids).toEqual(["z", "a", "b"]);
  });

  it("без focusCommentId тред не фетчится, лента без изменений", async () => {
    render(await CommentSection({ lectureId: "lec-1" }));

    expect(getCommentThread).not.toHaveBeenCalled();
    const ids = screen.getAllByTestId("root").map((el) => el.textContent);
    expect(ids).toEqual(["a", "b"]);
  });

  it("дедуп: если корень треда уже на 1-й странице — без дубля", async () => {
    vi.mocked(getCommentThread).mockResolvedValue({ root: { id: "a" }, descendants: [] } as never);

    render(await CommentSection({ lectureId: "lec-1", focusCommentId: "cmt-in-a" }));

    const ids = screen.getAllByTestId("root").map((el) => el.textContent);
    expect(ids).toEqual(["a", "b"]);
  });
});

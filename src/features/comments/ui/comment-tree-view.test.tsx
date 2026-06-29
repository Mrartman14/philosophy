// src/features/comments/ui/comment-tree-view.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import type { Comment, RootSubtree } from "../types";

import { CommentTreeView } from "./comment-tree-view";

afterEach(cleanup);

// Полная фикстура с обязательными полями comment.Comment — без `as`.
function node(id: string, username: string, parent_id?: string): Comment {
  return {
    id,
    lecture_id: "l",
    type: "claim",
    blocks: [],
    author: { id: "u", username },
    created_at: "2026-06-14T00:00:00Z",
    updated_at: "2026-06-14T00:00:00Z",
    ...(parent_id ? { parent_id } : {}),
  };
}

describe("CommentTreeView", () => {
  it("пусто → плашка", () => {
    render(<CommentTreeView subtrees={[]} />);
    expect(screen.getByText("Комментариев пока нет.")).toBeTruthy();
  });

  it("рендерит корень и потомков (read-only)", () => {
    const subtrees: RootSubtree[] = [
      {
        root: node("r", "root-author"),
        descendants: [node("a", "child-author", "r")],
      },
    ];
    render(<CommentTreeView subtrees={subtrees} />);
    expect(screen.getByText("root-author")).toBeTruthy();
    expect(screen.getByText("child-author")).toBeTruthy();
  });

  it("locale='en' пробрасывается во все узлы → даты в en-формате", () => {
    const subtrees: RootSubtree[] = [
      {
        root: node("r", "root-author"),
        descendants: [node("a", "child-author", "r")],
      },
    ];
    render(<CommentTreeView subtrees={subtrees} locale="en" />);
    // обе даты (корень + потомок) в en-формате со слэшами, без ru-точек.
    expect(screen.getAllByText(/6\/14\/26/)).toHaveLength(2);
    expect(screen.queryByText(/14\.06\.2026/)).toBeNull();
  });

  it("без locale → ru-fallback в датах (офлайн hook-free контракт)", () => {
    const subtrees: RootSubtree[] = [
      { root: node("r", "root-author"), descendants: [] },
    ];
    render(<CommentTreeView subtrees={subtrees} />);
    expect(screen.getByText(/14\.06\.2026/)).toBeTruthy();
  });
});

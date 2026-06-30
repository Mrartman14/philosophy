// src/features/comments/ui/comment-node-view.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import type { Comment } from "../types";

import { CommentNodeView } from "./comment-node-view";

afterEach(cleanup);

// Полная фикстура с обязательными полями comment.Comment — без `as` (иначе TS2352/лишний каст).
function base(over: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    lecture_id: "l1",
    type: "claim",
    blocks: [],
    author: { id: "u1", username: "alice" },
    created_at: "2026-06-14T10:30:00Z",
    updated_at: "2026-06-14T10:30:00Z",
    ...over,
  };
}

describe("CommentNodeView", () => {
  it("рендерит автора и дату", () => {
    render(<CommentNodeView comment={base()} />);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it("locale='en' → дата в en-формате (по умолчанию ru)", () => {
    render(<CommentNodeView comment={base()} locale="en" />);
    // en short date → "6/14/26" (со слэшами), ru → "14.06.2026" (с точками).
    expect(screen.getByText(/6\/14\/26/)).toBeTruthy();
    expect(screen.queryByText(/14\.06\.2026/)).toBeNull();
  });

  it("locale='ru' (дефолт) → дата в ru-формате", () => {
    render(<CommentNodeView comment={base()} locale="ru" />);
    expect(screen.getByText(/14\.06\.2026/)).toBeTruthy();
  });

  it("без locale → ru-fallback (офлайн hook-free контракт)", () => {
    render(<CommentNodeView comment={base()} />);
    expect(screen.getByText(/14\.06\.2026/)).toBeTruthy();
  });

  it("is_deleted → плашка, без тела", () => {
    render(<CommentNodeView comment={base({ is_deleted: true })} />);
    expect(screen.getByText("Комментарий удалён")).toBeTruthy();
    expect(screen.queryByText("alice")).toBeNull();
  });

  it("офлайн якорь: статичный сниппет anchor.exact (без слота)", () => {
    render(
      <CommentNodeView
        comment={base({
          anchor: {
            target_entity_type: "document",
            target_entity_id: "d1",
            exact: "цитата из текста",
          },
        })}
      />,
    );
    expect(screen.getByText("цитата из текста")).toBeTruthy();
  });

  it("офлайн реакции: read-only сводка (без слота)", () => {
    render(
      <CommentNodeView
        comment={base({ reactions: { agreement: { positive: 2, negative: 0 } } })}
      />,
    );
    expect(screen.getByText("+2 / −0")).toBeTruthy();
  });

  it("слоты переопределяют read-only части", () => {
    render(
      <CommentNodeView
        comment={base({
          anchor: {
            target_entity_type: "document",
            target_entity_id: "d1",
            exact: "static",
          },
          reactions: { agreement: { positive: 9, negative: 9 } },
        })}
        anchorSlot={<div>ANCHOR_SLOT</div>}
        reactionsSlot={<div>RXN_SLOT</div>}
        actionsSlot={<div>ACTIONS_SLOT</div>}
      />,
    );
    expect(screen.getByText("ANCHOR_SLOT")).toBeTruthy();
    expect(screen.getByText("RXN_SLOT")).toBeTruthy();
    expect(screen.getByText("ACTIONS_SLOT")).toBeTruthy();
    expect(screen.queryByText("static")).toBeNull();
    expect(screen.queryByText("+9 / −9")).toBeNull();
  });

  it("scopeEnabled → тело несёт data-anchor-scope=comment:<id> (онлайн annotation-scope)", () => {
    const { container } = render(
      <CommentNodeView
        comment={base({
          id: "cmt-1",
          blocks: [
            {
              id: "b1",
              type: "paragraph",
              content: [{ type: "text", text: "тело" }],
            },
          ] as never,
        })}
        scopeEnabled
      />,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- data-* scope-маркер, семантической роли нет (прецедент: semantic-map-direction.test.tsx)
    const scope = container.querySelector('[data-anchor-scope="comment:cmt-1"]');
    expect(scope).not.toBeNull();
    expect(scope?.textContent).toContain("тело");
  });

  it("без scopeEnabled (офлайн/изоморфный путь) → тело без data-anchor-scope", () => {
    const { container } = render(<CommentNodeView comment={base({ id: "cmt-2" })} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- data-* scope-маркер, семантической роли нет
    expect(container.querySelector("[data-anchor-scope]")).toBeNull();
  });
});

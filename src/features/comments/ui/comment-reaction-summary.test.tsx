// src/features/comments/ui/comment-reaction-summary.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import { CommentReactionSummary } from "./comment-reaction-summary";

afterEach(cleanup);

describe("CommentReactionSummary", () => {
  it("рендерит сводку agreement (+pos / −neg)", () => {
    render(
      <CommentReactionSummary
        reactions={{ agreement: { positive: 3, negative: 1 } }}
      />,
    );
    expect(screen.getByText("+3 / −1")).toBeTruthy();
  });

  it("рендерит insight как ★ count", () => {
    render(<CommentReactionSummary reactions={{ insight: 5 }} />);
    expect(screen.getByText("★ 5")).toBeTruthy();
  });

  it("undefined reactions → ничего (null)", () => {
    render(<CommentReactionSummary reactions={undefined} />);
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("пустая сводка (нули) → ничего", () => {
    render(
      <CommentReactionSummary
        reactions={{ agreement: { positive: 0, negative: 0 } }}
      />,
    );
    expect(screen.queryByText(/./)).toBeNull();
  });
});

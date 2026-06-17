import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyReactions } from "../types";

// Mock server actions so jsdom never pulls the server-only client.
const setReaction = vi.fn();
const removeReaction = vi.fn();
vi.mock("../actions", () => ({
  setReaction: (...args: unknown[]) => setReaction(...args) as unknown,
  removeReaction: (...args: unknown[]) => removeReaction(...args) as unknown,
}));

import { applyReactionPatch, CommentReactions } from "./comment-reactions";

afterEach(cleanup);
beforeEach(() => {
  setReaction.mockReset();
  removeReaction.mockReset();
  setReaction.mockResolvedValue({ success: true, data: null });
  removeReaction.mockResolvedValue({ success: true, data: null });
});

// ── Reducer: applyReactionPatch (pure, exactOptionalPropertyTypes-safe) ───────

describe("applyReactionPatch", () => {
  it("устанавливает новое значение оси на пустом состоянии", () => {
    expect(applyReactionPatch(undefined, { axis: "agreement", value: 1, isSame: false })).toEqual({
      agreement: 1,
    });
  });

  it("isSame → удаляет ключ оси целиком", () => {
    const next = applyReactionPatch({ agreement: 1 }, { axis: "agreement", value: 1, isSame: true });
    expect(next.agreement).toBeUndefined();
    expect(Object.keys(next)).not.toContain("agreement");
  });

  it("insight: toggle on → true, toggle off → false", () => {
    expect(applyReactionPatch(undefined, { axis: "insight", value: 1, isSame: false })).toEqual({
      insight: true,
    });
    expect(applyReactionPatch({ insight: true }, { axis: "insight", value: 1, isSame: true })).toEqual({
      insight: false,
    });
  });

  it("сохраняет другие оси при изменении одной", () => {
    expect(
      applyReactionPatch({ agreement: 1 }, { axis: "quality", value: -1, isSame: false }),
    ).toEqual({ agreement: 1, quality: -1 });
    expect(
      applyReactionPatch({ insight: true }, { axis: "agreement", value: 1, isSame: false }),
    ).toEqual({ insight: true, agreement: 1 });
  });
});

// ── Component ─────────────────────────────────────────────────────────────────

const AGREE_YES = "Согласие: согласен";
const AGREE_NO = "Согласие: не согласен";
const QUALITY_YES = "Качество: высокое качество";

describe("CommentReactions", () => {
  it("aria-pressed отражает myReactions; aria-label ось-корректен", () => {
    const my: MyReactions = { agreement: 1 };
    render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={my}
        allowedAxes={["agreement"]}
        canReact
      />,
    );
    expect(screen.getByLabelText(AGREE_YES)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(AGREE_NO)).toHaveAttribute("aria-pressed", "false");
  });

  it("canReact=false → кнопки disabled; canReact=true → enabled", () => {
    const { rerender } = render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={undefined}
        allowedAxes={["agreement"]}
        canReact={false}
      />,
    );
    expect(screen.getByLabelText(AGREE_YES)).toBeDisabled();

    rerender(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={undefined}
        allowedAxes={["agreement"]}
        canReact
      />,
    );
    expect(screen.getByLabelText(AGREE_YES)).not.toBeDisabled();
  });

  it("оптимистично флипает aria-pressed до резолва и НЕ блокирует вторую ось во время полёта", async () => {
    let resolveFirst: ((v: unknown) => void) | undefined;
    setReaction.mockReturnValueOnce(
      new Promise((r) => {
        resolveFirst = r;
      }),
    );
    render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={undefined}
        allowedAxes={["agreement", "quality"]}
        canReact
      />,
    );
    const agreeYes = screen.getByLabelText(AGREE_YES);
    fireEvent.click(agreeYes);

    // Оптимистичное состояние применилось, экшен ещё в полёте.
    await waitFor(() => {
      expect(agreeYes).toHaveAttribute("aria-pressed", "true");
    });
    // Вторая ось остаётся кликабельной (нет blanket pending-disable).
    expect(screen.getByLabelText(QUALITY_YES)).not.toBeDisabled();
    expect(agreeYes).not.toBeDisabled();

    resolveFirst?.({ success: true, data: null });
  });

  it("активная кнопка вызывает removeReaction (toggle off)", () => {
    render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={{ agreement: 1 }}
        allowedAxes={["agreement"]}
        canReact
      />,
    );
    fireEvent.click(screen.getByLabelText(AGREE_YES));
    expect(removeReaction).toHaveBeenCalledWith({ id: "c1", axis: "agreement" });
    expect(setReaction).not.toHaveBeenCalled();
  });

  it("forbidden → branded «У вас нет прав на реакцию.»", async () => {
    setReaction.mockResolvedValueOnce({ success: false, code: "forbidden", error: "Forbidden" });
    render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={undefined}
        allowedAxes={["agreement"]}
        canReact
      />,
    );
    fireEvent.click(screen.getByLabelText(AGREE_YES));
    expect(await screen.findByText("У вас нет прав на реакцию.")).toBeInTheDocument();
  });

  it("не-forbidden ошибка → сырое сообщение сервера", async () => {
    setReaction.mockResolvedValueOnce({ success: false, error: "Сервер недоступен" });
    render(
      <CommentReactions
        commentId="c1"
        type="claim"
        reactions={undefined}
        myReactions={undefined}
        allowedAxes={["agreement"]}
        canReact
      />,
    );
    fireEvent.click(screen.getByLabelText(AGREE_YES));
    expect(await screen.findByText("Сервер недоступен")).toBeInTheDocument();
  });
});

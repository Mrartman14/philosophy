import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { AstMergeView, type MergeViewLabels } from "./ast-merge-view";

vi.mock("@/components/ast-render", () => ({
  AstRender: ({ blocks }: { blocks: AstBlock[] }) => (
    <div data-testid="ast-render">{blocks.map((b) => b.text).join("")}</div>
  ),
}));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  // Минимальный Dialog: реальный Base UI Dialog с порталом/focus-trap трудно
  // драйвить в jsdom; для рендера достаточно отрисовать содержимое при open.
  Dialog: ({
    open,
    title,
    children,
  }: {
    open?: boolean;
    title?: string;
    children?: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const labels: MergeViewLabels = {
  title: "T",
  intro: "I",
  badgeServerChanged: "srv-changed",
  badgeYourEdit: "your-edit",
  badgeAddedByYou: "added-you",
  badgeAddedOnServer: "added-srv",
  badgeRemovedByYou: "removed-you",
  badgeRemovedOnServer: "removed-srv",
  conflictHeading: "conflict-pick",
  optionServer: "opt-srv",
  optionMine: "opt-mine",
  acceptDeletion: "accept-deletion",
  contentChanged: "content-changed",
  unchangedLabel: "unchanged",
  showUnchanged: "show-unchanged",
  hideUnchanged: "hide-unchanged",
  applyButton: "apply",
  cancelButton: "cancel",
  takeServerButton: "take-server",
};
// Реалистичная редакторная форма блока: параграф несёт `content` (источник
// истины), `text` — производное. Без `content` нормализация (normalizeBlocks)
// схлопнула бы `text` в "" — реальный редактор такие блоки не выдаёт.
function p(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text, content: [{ type: "text", text }] };
}
// Структурный блок без текста (картинка): различается только attrs, text === "".
function img(id: string, src: string): AstBlock {
  return { id, type: "image", text: "", attrs: { src } };
}
const noop = () => undefined;

afterEach(cleanup);

describe("AstMergeView", () => {
  it("кнопка apply заблокирована, пока конфликт не решён, и onApply отдаёт выбранную сторону", () => {
    const onApply = vi.fn<(blocks: AstBlock[]) => void>();
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A-mine")]}
        theirs={[p("a", "A-srv")]}
        labels={labels}
        onApply={onApply}
        onCancel={noop}
        onTakeServer={noop}
      />,
    );
    const apply = screen.getByText("apply");
    expect(apply).toBeDisabled();

    // выбрать серверную версию конфликта (radio внутри label «opt-srv»)
    fireEvent.click(screen.getByLabelText(/opt-srv/));
    expect(apply).not.toBeDisabled();

    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    const appliedBlocks = onApply.mock.calls[0]?.[0] ?? [];
    expect(appliedBlocks.map((b) => b.text)).toEqual(["A-srv"]);
  });

  it("onCancel вызывается по кнопке cancel", () => {
    const onCancel = vi.fn();
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A")]}
        theirs={[p("a", "A")]}
        labels={labels}
        onApply={noop}
        onCancel={onCancel}
        onTakeServer={noop}
      />,
    );
    fireEvent.click(screen.getByText("cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("onTakeServer вызывается по escape-hatch кнопке", () => {
    const onTakeServer = vi.fn();
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A-mine")]}
        theirs={[p("a", "A-srv")]}
        labels={labels}
        onApply={noop}
        onCancel={noop}
        onTakeServer={onTakeServer}
      />,
    );
    fireEvent.click(screen.getByText("take-server"));
    expect(onTakeServer).toHaveBeenCalledTimes(1);
  });

  it("конфликт рендерит role=radiogroup", () => {
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A-mine")]}
        theirs={[p("a", "A-srv")]}
        labels={labels}
        onApply={noop}
        onCancel={noop}
        onTakeServer={noop}
      />,
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("structural-conflict с одной удалённой стороной показывает acceptDeletion, а не пустой вариант", () => {
    // mine изменил блок, theirs удалил → structural-conflict, theirs === null.
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A-mine")]}
        theirs={[]}
        labels={labels}
        onApply={noop}
        onCancel={noop}
        onTakeServer={noop}
      />,
    );
    expect(screen.getByText("accept-deletion")).toBeInTheDocument();
    // сторона с контентом всё ещё видна (AstRender + word-diff → >=1 вхождение)
    expect(screen.getAllByText("A-mine").length).toBeGreaterThan(0);
  });

  it("server-only картиночный блок (пустой text) показывает contentChanged вместо пустого diff", () => {
    // theirs изменил attrs картинки (src), text пуст у обеих сторон → contentChanged.
    render(
      <AstMergeView
        base={[img("i", "old.png")]}
        mine={[img("i", "old.png")]}
        theirs={[img("i", "new.png")]}
        labels={labels}
        onApply={noop}
        onCancel={noop}
        onTakeServer={noop}
      />,
    );
    expect(screen.getByText("content-changed")).toBeInTheDocument();
  });

  it("разворачивание unchanged-блоков переключается кнопкой", () => {
    render(
      <AstMergeView
        base={[p("a", "A"), p("b", "B")]}
        mine={[p("a", "A"), p("b", "B-mine")]}
        theirs={[p("a", "A"), p("b", "B")]}
        labels={labels}
        onApply={noop}
        onCancel={noop}
        onTakeServer={noop}
      />,
    );
    // блок "a" unchanged → есть кнопка-разворот; "A" не отрисован до раскрытия
    const toggle = screen.getByText(/show-unchanged/);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("A")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText(/hide-unchanged/)).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

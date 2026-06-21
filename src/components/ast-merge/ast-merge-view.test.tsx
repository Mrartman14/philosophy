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
  unchangedLabel: "unchanged",
  applyButton: "apply",
  cancelButton: "cancel",
};
// Реалистичная редакторная форма блока: параграф несёт `content` (источник
// истины), `text` — производное. Без `content` нормализация (normalizeBlocks)
// схлопнула бы `text` в "" — реальный редактор такие блоки не выдаёт.
function p(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text, content: [{ type: "text", text }] };
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
      />,
    );
    const apply = screen.getByText("apply");
    expect(apply).toBeDisabled();

    // выбрать серверную версию конфликта
    fireEvent.click(screen.getByLabelText("opt-srv"));
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
      />,
    );
    fireEvent.click(screen.getByText("cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

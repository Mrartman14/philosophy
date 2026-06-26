import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContextMenu } from "./context-menu";

afterEach(cleanup);

function Harness({ onPick }: { onPick: () => void }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div data-testid="area">right-click me</div>} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.Item onClick={onPick}>Action</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

describe("ui/ContextMenu", () => {
  // ВНИМАНИЕ (ревью): прецеденты репо (menu.test.tsx, lecture-actions-menu.test.tsx)
  // проверяют ТОЛЬКО наличие пункта в DOM, НЕ дёргают Item.onClick через fireEvent
  // (композитная pointer-машина Base UI Item делает fireEvent.click(item)→onClick
  // недетерминированным в jsdom). Поэтому здесь — только открытие+рендер пункта;
  // клик-по-пункту → действие проверяется браузер-QA, не юнитом.
  it("opens on contextmenu and renders the item", async () => {
    render(<Harness onPick={vi.fn()} />);
    fireEvent.contextMenu(screen.getByTestId("area"));
    expect(await screen.findByRole("menuitem", { name: "Action" })).toBeInTheDocument();
  });
});

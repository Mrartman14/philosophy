import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Popover } from "./popover";

afterEach(cleanup);

describe("Popover (compound)", () => {
  it("renders trigger; opens popup content on defaultOpen", () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Открыть</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    expect(screen.getByText("Открыть")).toBeInTheDocument();
    expect(screen.getByText("Контент")).toBeInTheDocument();
  });

  it("Popup merges custom className over the surface default", () => {
    render(
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup className="p-3">Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    const popup = screen.getByText("Контент");
    expect(popup).toHaveClass("p-3");
    expect(popup).toHaveClass("shadow-lg");
  });

  it("forwards ref to the Popup element (initialFocus/Positioner risk per spec)", () => {
    // Base UI Popover.Popup рендерит <div>, его ref — HTMLDivElement (не широкий HTMLElement),
    // иначе TS2322: RefObject<HTMLElement> не присваивается Ref<HTMLDivElement>.
    const ref = createRef<HTMLDivElement>();
    render(
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup ref={ref}>Контент</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toHaveTextContent("Контент");
  });
});

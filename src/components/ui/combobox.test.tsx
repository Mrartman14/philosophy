import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Combobox } from "./combobox";

afterEach(cleanup);

describe("Combobox (compound)", () => {
  it("рендерит элементы и фильтрует по вводу (defaultOpen, inline items)", () => {
    render(
      <Combobox.Root items={["alpha", "beta"]} defaultOpen filter={null}>
        <Combobox.Input />
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>{item}</Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Root>,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("Popup мёржит custom className поверх surface-дефолта", () => {
    render(
      <Combobox.Root items={[]} defaultOpen>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup className="p-1">контент</Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    const popup = screen.getByText("контент");
    expect(popup).toHaveClass("p-1");
    expect(popup).toHaveClass("shadow-lg");
  });
});

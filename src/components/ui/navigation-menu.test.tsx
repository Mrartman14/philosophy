import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NavigationMenu } from "./navigation-menu";

afterEach(cleanup);

describe("NavigationMenu (compound)", () => {
  it("renders Root>List>Item content", () => {
    render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>Пункт</NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>,
    );
    expect(screen.getByText("Пункт")).toBeInTheDocument();
  });

  it("Item forwards className", () => {
    // Item рендерит <li> с текстом и className напрямую — assert через
    // Testing-Library-запрос (а не container.querySelector), как в соседних
    // обёртках (toolbar/popover): запрос по тексту + toHaveClass.
    render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item className="custom-x">П</NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>,
    );
    expect(screen.getByText("П")).toHaveClass("custom-x");
  });
});

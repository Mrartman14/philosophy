import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import { Menu } from "./menu";

afterEach(cleanup);

function Harness() {
  return (
    <Menu.Root>
      <Menu.Trigger render={<Button type="button" tone="quiet" />}>Действия</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.LinkItem href="/x.md">Скачать .md</Menu.LinkItem>
            <Menu.Item>Действие</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

describe("Menu (kit)", () => {
  it("триггер открывает попап с пунктами; LinkItem — ссылка", async () => {
    render(<Harness />);
    // Base UI Menu открывается по pointerdown→click; в jsdom (нет user-event в
    // репо) триггерим обе фазы через fireEvent, как рабочий паттерн overlay-тестов.
    const trigger = screen.getByRole("button", { name: "Действия" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    const link = await screen.findByRole("menuitem", { name: "Скачать .md" });
    expect(link).toHaveAttribute("href", "/x.md");
    expect(screen.getByRole("menuitem", { name: "Действие" })).toBeInTheDocument();
  });
});

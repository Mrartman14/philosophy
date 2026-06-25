import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs } from "./tabs";

afterEach(cleanup);

function Fixture() {
  return (
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="разделы">
        <Tabs.Tab value="a">Вкладка A</Tabs.Tab>
        <Tabs.Tab value="b">Вкладка B</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="a">Контент A</Tabs.Panel>
      <Tabs.Panel value="b">Контент B</Tabs.Panel>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
  it("рендерит tablist с вкладками и активную панель по defaultValue", () => {
    render(<Fixture />);
    expect(screen.getByRole("tablist", { name: "разделы" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    // активная панель имеет роль tabpanel (a11y-контракт Base UI)
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByText("Контент A")).toBeInTheDocument();
    // keepMounted=false по умолчанию — неактивная панель не в DOM
    expect(screen.queryByText("Контент B")).not.toBeInTheDocument();
  });

  it("переключает активную панель по клику на вкладку", () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole("tab", { name: "Вкладка B" }));
    expect(screen.getByText("Контент B")).toBeInTheDocument();
    expect(screen.queryByText("Контент A")).not.toBeInTheDocument();
  });
});

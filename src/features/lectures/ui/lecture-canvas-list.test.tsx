import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureCanvasList } from "./lecture-canvas-list";

afterEach(cleanup);

const labels = {
  heading: "Канвасы лекции",
  entryBadge: "Основной",
  untitledLabel: "Без названия",
};

describe("LectureCanvasList", () => {
  it("ссылки на /canvases/{id}; основной первым с бейджем; токен в href", () => {
    render(
      <LectureCanvasList
        canvases={[
          { id: "c1", title: "Первый" },
          { id: "c2", title: "Основной граф", is_entry: true },
        ]}
        token="TOK"
        {...labels}
      />,
    );
    expect(screen.getByRole("region", { name: "Канвасы лекции" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    // основной (is_entry) первым
    expect(links.map((l) => l.textContent)).toEqual(["Основной граф", "Первый"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/canvases/c2?token=TOK",
      "/canvases/c1?token=TOK",
    ]);
    expect(screen.getByText("Основной")).toBeInTheDocument();
  });

  it("без токена — чистый href; канвас без названия → фолбэк-лейбл", () => {
    render(<LectureCanvasList canvases={[{ id: "c1" }]} {...labels} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/canvases/c1");
    expect(link).toHaveTextContent("Без названия");
  });

  it("пустой список → ничего не рендерит", () => {
    const { container } = render(<LectureCanvasList canvases={[]} {...labels} />);
    expect(container).toBeEmptyDOMElement();
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureFormList } from "./lecture-form-list";

afterEach(cleanup);

const labels = {
  heading: "Формы лекции",
  entryBadge: "Основная",
  untitledLabel: "Без названия",
};

describe("LectureFormList", () => {
  it("ссылки на /forms/{id}; основная первой с бейджем; токен в href", () => {
    render(
      <LectureFormList
        forms={[
          { id: "f1", title: "Опрос" },
          { id: "f2", title: "Регистрация", is_entry: true },
        ]}
        token="TOK"
        {...labels}
      />,
    );
    expect(screen.getByRole("region", { name: "Формы лекции" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Регистрация", "Опрос"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/forms/f2?token=TOK",
      "/forms/f1?token=TOK",
    ]);
    expect(screen.getByText("Основная")).toBeInTheDocument();
  });

  it("без токена — чистый href; форма без названия → фолбэк-лейбл", () => {
    render(<LectureFormList forms={[{ id: "f1" }]} {...labels} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/forms/f1");
    expect(link).toHaveTextContent("Без названия");
  });

  it("пустой список → ничего не рендерит", () => {
    const { container } = render(<LectureFormList forms={[]} {...labels} />);
    expect(container).toBeEmptyDOMElement();
  });
});

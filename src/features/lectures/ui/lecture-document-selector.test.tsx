import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureDocumentSelector } from "./lecture-document-selector";

afterEach(cleanup);

describe("LectureDocumentSelector", () => {
  it("ссылки на документы; активная — aria-current + токен в href", () => {
    render(
      <LectureDocumentSelector
        documents={[
          { id: "d1", filename: "Первый" },
          { id: "d2", filename: "Второй" },
        ]}
        activeId="d1"
        token="TOK"
        navLabel="Документы лекции"
      />,
    );
    expect(screen.getByRole("navigation", { name: "Документы лекции" })).toBeInTheDocument();
    const first = screen.getByRole("link", { name: "Первый" });
    const second = screen.getByRole("link", { name: "Второй" });
    expect(first).toHaveAttribute("aria-current", "page");
    expect(second).not.toHaveAttribute("aria-current");
    expect(first.getAttribute("href")).toContain("doc=d1");
    expect(first.getAttribute("href")).toContain("token=TOK");
    expect(second.getAttribute("href")).toContain("doc=d2");
  });

  it("один документ → null", () => {
    const { container } = render(
      <LectureDocumentSelector
        documents={[{ id: "d1", filename: "Один" }]}
        activeId="d1"
        navLabel="Документы лекции"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

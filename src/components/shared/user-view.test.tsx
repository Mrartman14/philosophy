// src/components/shared/user-view.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UserView } from "./user-view";

const UUID = "11111111-2222-3333-4444-555555555555";

afterEach(cleanup);

describe("UserView", () => {
  it("показывает username, когда он есть (id не светится)", () => {
    render(<UserView username="alex_b" id={UUID} />);
    expect(screen.getByText("alex_b")).toBeInTheDocument();
    expect(screen.queryByText(UUID)).not.toBeInTheDocument();
  });

  it("падает на UUID (моноширинный, dir=ltr), когда имени нет", () => {
    render(<UserView id={UUID} />);
    const el = screen.getByText(UUID);
    expect(el).toHaveAttribute("dir", "ltr");
    expect(el).toHaveClass("font-mono");
  });

  it("пустой/whitespace username трактуется как отсутствующий", () => {
    render(<UserView username="   " id={UUID} />);
    expect(screen.getByText(UUID)).toBeInTheDocument();
  });

  it("показывает «—», когда нет ни имени, ни id", () => {
    render(<UserView />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

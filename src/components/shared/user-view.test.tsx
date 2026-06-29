// src/components/shared/user-view.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UserView } from "./user-view";

const UUID = "11111111-2222-3333-4444-555555555555";

afterEach(cleanup);

describe("UserView", () => {
  it("показывает username, когда он есть (id не светится)", () => {
    render(<UserView user={{ id: UUID, username: "alex_b" }} />);
    expect(screen.getByText("alex_b")).toBeInTheDocument();
    expect(screen.queryByText(UUID)).not.toBeInTheDocument();
  });

  it("падает на UUID (моноширинный, dir=ltr), когда имени нет", () => {
    render(<UserView user={{ id: UUID }} />);
    const el = screen.getByText(UUID);
    expect(el).toHaveAttribute("dir", "ltr");
    expect(el).toHaveClass("font-mono");
  });

  it("пустой/whitespace username трактуется как отсутствующий", () => {
    render(<UserView user={{ id: UUID, username: "   " }} />);
    expect(screen.getByText(UUID)).toBeInTheDocument();
  });

  it("«—», когда есть только username-ключ без значения (id не передан)", () => {
    render(<UserView user={{ username: undefined }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("показывает «—», когда user отсутствует целиком", () => {
    render(<UserView />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

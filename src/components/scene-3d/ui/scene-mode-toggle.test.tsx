// src/components/scene-3d/ui/scene-mode-toggle.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

// kit Button замокан простым <button> — проверяем проводку, не стили.
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, "aria-pressed": pressed }: {
    children: React.ReactNode;
    onClick?: () => void;
    "aria-pressed"?: boolean;
  }) => (
    <button onClick={onClick} aria-pressed={pressed}>{children}</button>
  ),
}));

afterEach(cleanup);

import { SceneModeToggle } from "./scene-mode-toggle";

describe("SceneModeToggle", () => {
  it("рендерит 2D/3D и помечает активный режим", () => {
    render(
      <SceneModeToggle mode="2d" onChange={vi.fn()} ariaLabel="Размерность" storageKey="k" />,
    );
    const group = screen.getByRole("group", { name: "Размерность" });
    expect(group).toBeInTheDocument();
    expect(screen.getByText("2D")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3D")).toHaveAttribute("aria-pressed", "false");
  });

  it("клик по 3D зовёт onChange('3d')", () => {
    const onChange = vi.fn();
    render(
      <SceneModeToggle mode="2d" onChange={onChange} ariaLabel="A" storageKey="k" />,
    );
    fireEvent.click(screen.getByText("3D"));
    expect(onChange).toHaveBeenCalledWith("3d");
  });
});

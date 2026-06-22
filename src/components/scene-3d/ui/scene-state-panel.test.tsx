// src/components/scene-3d/ui/scene-state-panel.test.tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

afterEach(cleanup);

import { SceneStatePanel } from "./scene-state-panel";

describe("SceneStatePanel", () => {
  it("reason='building' → показывает buildingText", () => {
    render(<SceneStatePanel reason="building" buildingText="Строится" errorText="Ошибка" />);
    expect(screen.getByText("Строится")).toBeInTheDocument();
    expect(screen.queryByText("Ошибка")).not.toBeInTheDocument();
  });

  it("reason='error' → показывает errorText", () => {
    render(<SceneStatePanel reason="error" buildingText="Строится" errorText="Ошибка" />);
    expect(screen.getByText("Ошибка")).toBeInTheDocument();
    expect(screen.queryByText("Строится")).not.toBeInTheDocument();
  });
});

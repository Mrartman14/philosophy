import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WideShell, WIDE_SHELL_INNER } from "./wide-shell";

afterEach(cleanup);

describe("WideShell", () => {
  it("внутренний контейнер центрирован и капнут до screen-lg", () => {
    expect(WIDE_SHELL_INNER).toContain("mx-auto");
    expect(WIDE_SHELL_INNER).toContain("max-w-screen-lg");
  });
  it("оборачивает детей в bleed → центрированный кап", () => {
    render(<WideShell><span>dash</span></WideShell>);
    // bleed/cap-обёртки не имеют роли/лейбла — поднимаемся к ним от ребёнка (прецедент: router-link-busy.test.tsx).
    // eslint-disable-next-line testing-library/no-node-access
    const inner = screen.getByText("dash").parentElement;
    expect(inner).toHaveClass("max-w-screen-lg");
    // eslint-disable-next-line testing-library/no-node-access
    const bleed = inner?.parentElement;
    expect(bleed).toHaveClass("col-bleed");
  });
});

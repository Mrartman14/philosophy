import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FullBleed, FULL_BLEED_CLASS } from "./full-bleed";

afterEach(cleanup);

describe("FullBleed", () => {
  it("FULL_BLEED_CLASS — логическая bleed-колонка", () => {
    expect(FULL_BLEED_CLASS).toBe("col-bleed");
  });
  it("рендерит детей в bleed-обёртке + прокидывает className", () => {
    render(<FullBleed className="h-[80vh]"><span>scene</span></FullBleed>);
    // bleed-обёртка не имеет роли/лейбла — поднимаемся к ней от ребёнка (прецедент: router-link-busy.test.tsx).
    // eslint-disable-next-line testing-library/no-node-access
    const el = screen.getByText("scene").parentElement;
    expect(el).toHaveClass("col-bleed");
    expect(el).toHaveClass("h-[80vh]");
  });
});

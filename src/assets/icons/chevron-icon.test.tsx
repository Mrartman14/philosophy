import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChevronIcon } from "./chevron-icon";

afterEach(cleanup);

describe("ChevronIcon", () => {
  it("рендерит svg и принимает className (для .rtl-flip)", () => {
    const { container } = render(<ChevronIcon className="rtl-flip" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: semantic-map-direction.test.tsx)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("class")).toContain("rtl-flip");
  });
});

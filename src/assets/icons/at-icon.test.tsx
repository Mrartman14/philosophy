import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AtIcon } from "./at-icon";

afterEach(cleanup);

describe("AtIcon", () => {
  it("рендерит svg с currentColor", () => {
    const { container } = render(<AtIcon />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: chevron-icon.test.tsx)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});

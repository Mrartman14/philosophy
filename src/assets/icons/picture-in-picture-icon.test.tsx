import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PictureInPictureIcon } from "./picture-in-picture-icon";

afterEach(cleanup);

describe("PictureInPictureIcon", () => {
  it("рендерит aria-hidden svg и принимает className", () => {
    const { container } = render(<PictureInPictureIcon className="text-xl" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: chevron-icon.test.tsx)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toContain("text-xl");
  });
});

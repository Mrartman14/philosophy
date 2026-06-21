import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Fieldset } from "./fieldset";

afterEach(cleanup);

describe("Fieldset", () => {
  it("renders a real <legend> element (not <div>) with the caption when legend provided", () => {
    render(
      <Fieldset legend="Видимость">
        <span>child</span>
      </Fieldset>,
    );
    const legend = screen.getByText("Видимость");
    expect(legend.tagName).toBe("LEGEND"); // ловит регресс: base-ui по умолчанию даёт <div>
    expect(screen.getByRole("group")).toContainElement(legend); // legend — подпись fieldset
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders no legend caption when legend omitted", () => {
    render(
      <Fieldset>
        <span>child</span>
      </Fieldset>,
    );
    expect(screen.getByRole("group")).not.toHaveAccessibleName();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("forwards className to the fieldset element", () => {
    render(
      <Fieldset className="custom-x">
        <span>c</span>
      </Fieldset>,
    );
    expect(screen.getByRole("group")).toHaveClass("custom-x");
  });
});

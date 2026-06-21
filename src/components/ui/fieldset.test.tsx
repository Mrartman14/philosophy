import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Fieldset } from "./fieldset";

afterEach(cleanup);

describe("Fieldset", () => {
  it("renders a real <legend> element (not <div>) with the caption when legend provided", () => {
    const { container } = render(
      <Fieldset legend="Видимость">
        <span>child</span>
      </Fieldset>,
    );
    const legend = container.querySelector("legend");
    expect(legend).not.toBeNull(); // ловит регресс: base-ui по умолчанию даёт <div>
    expect(legend).toHaveTextContent("Видимость");
    expect(legend?.closest("fieldset")).not.toBeNull(); // legend — подпись fieldset
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("renders no legend element when legend omitted", () => {
    const { container } = render(
      <Fieldset>
        <span>child</span>
      </Fieldset>,
    );
    expect(container.querySelector("legend")).toBeNull();
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("forwards className to the fieldset element", () => {
    const { container } = render(<Fieldset className="custom-x"><span>c</span></Fieldset>);
    expect(container.querySelector("fieldset")).toHaveClass("custom-x");
  });
});

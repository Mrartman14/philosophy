import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { DirectionProvider } from "@/components/ui";
import { dirForLocale } from "@/i18n/locales";

afterEach(cleanup);

describe("RTL wiring (smoke)", () => {
  it("dirForLocale кормит DirectionProvider значением rtl для арабского", () => {
    const dir = dirForLocale("ar");
    expect(dir).toBe("rtl");
    render(
      <DirectionProvider direction={dir}>
        <span data-testid="child">x</span>
      </DirectionProvider>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });
});

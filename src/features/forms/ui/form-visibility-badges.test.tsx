import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", async () => {
  const { default: forms } = await import("@/i18n/messages/ru/forms");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable */ let v: any = forms; for (const p of parts) v = v?.[p]; /* eslint-enable */
        return typeof v === "string" ? v : key;
      }),
  };
});

import { FormVisibilityBadges } from "./form-visibility-badges";

afterEach(cleanup);

describe("FormVisibilityBadges", () => {
  it("публичная форма + публичные результаты + immutable", async () => {
    render(await FormVisibilityBadges({ form: { visibility: "public", submission_visibility: "public", submission_mode: "immutable" } as never }));
    expect(screen.getByText("Форма: публичная")).toBeTruthy();
    expect(screen.getByText("Результаты: публичные")).toBeTruthy();
    expect(screen.getByText("Режим: фиксированный")).toBeTruthy();
  });
});

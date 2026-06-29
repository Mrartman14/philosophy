import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/i18n", async () => {
  const { default: forms } = await import("@/i18n/messages/ru/forms");
  return {
    getT: (_ns: string) =>
      Promise.resolve((key: string) => {
        const parts = key.split(".");
        /* eslint-disable */
        let val: any = forms;
        for (const p of parts) val = val?.[p];
        /* eslint-enable */
        return typeof val === "string" ? val : key;
      }),
  };
});

import { ChoiceBars } from "./choice-bars";

afterEach(cleanup);

describe("ChoiceBars", () => {
  const options = [
    { option_id: "o1", label: "Философия", count: 7 },
    { option_id: "o2", label: "История", count: 3 },
  ];

  it("показывает лейблы, счётчики и проценты (база = answered)", async () => {
    render(await ChoiceBars({ options, answered: 12, multi: false }));
    expect(screen.getByText("Философия")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("58%")).toBeTruthy(); // 7/12
    expect(screen.getByText("25%")).toBeTruthy(); // 3/12
  });

  it("answered=0 → 0% без деления на ноль", async () => {
    render(await ChoiceBars({ options: [{ option_id: "o", label: "X", count: 0 }], answered: 0, multi: false }));
    expect(screen.getByText("0%")).toBeTruthy();
  });
});

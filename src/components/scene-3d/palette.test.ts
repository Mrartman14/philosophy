import { describe, it, expect } from "vitest";

import { hexToRgb01 } from "./palette";

describe("hexToRgb01", () => {
  it("маппит крайние значения", () => {
    expect(hexToRgb01("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb01("#000000")).toEqual([0, 0, 0]);
  });
  it("маппит компоненты", () => {
    expect(hexToRgb01("#ff8000")).toEqual([1, 128 / 255, 0]);
  });
});

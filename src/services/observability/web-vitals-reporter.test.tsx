import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { histogram } = vi.hoisted(() => ({ histogram: vi.fn() }));
vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, metrics: { histogram } };
});

// Захватываем callback, который компонент передаёт в useReportWebVitals,
// и сразу дёргаем его синтетической метрикой.
let reportCb: ((m: { name: string; value: number; rating: string }) => void) | null = null;
vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (cb: (m: { name: string; value: number; rating: string }) => void) => {
    reportCb = cb;
  },
}));

import { WebVitalsReporter } from "./web-vitals-reporter";

afterEach(cleanup);
beforeEach(() => {
  histogram.mockClear();
  reportCb = null;
});

describe("WebVitalsReporter", () => {
  it("forwards a web-vital to metrics.histogram with prefixed name and rating", () => {
    render(<WebVitalsReporter />);
    expect(reportCb).toBeTypeOf("function");
    if (reportCb) {
      reportCb({ name: "LCP", value: 1234.5, rating: "good" });
    }
    expect(histogram).toHaveBeenCalledWith("web_vitals.LCP", 1234.5, {
      rating: "good",
    });
  });

  it("renders nothing", () => {
    const { container } = render(<WebVitalsReporter />);
    expect(container).toBeEmptyDOMElement();
  });
});

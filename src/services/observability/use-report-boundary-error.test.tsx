import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("./client", () => ({ errors: { capture } }));

import { useReportBoundaryError } from "./use-report-boundary-error";

function Probe({ error }: { error: Error & { digest?: string } }) {
  useReportBoundaryError(error);
  return null;
}

afterEach(cleanup);
beforeEach(() => capture.mockClear());

describe("useReportBoundaryError", () => {
  it("captures the error as unhandled with its digest", () => {
    const err = Object.assign(new Error("boom"), { digest: "d-42" });
    render(<Probe error={err} />);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(err, {
      handled: false,
      attributes: { digest: "d-42" },
    });
  });

  it("passes digest as null when absent", () => {
    const err = new Error("no-digest") as Error & { digest?: string };
    render(<Probe error={err} />);
    expect(capture).toHaveBeenCalledWith(err, {
      handled: false,
      attributes: { digest: null },
    });
  });

  it("re-captures when the error identity changes", () => {
    const a = Object.assign(new Error("a"), { digest: "a" });
    const b = Object.assign(new Error("b"), { digest: "b" });
    const { rerender } = render(<Probe error={a} />);
    rerender(<Probe error={b} />);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture).toHaveBeenLastCalledWith(b, {
      handled: false,
      attributes: { digest: "b" },
    });
  });
});

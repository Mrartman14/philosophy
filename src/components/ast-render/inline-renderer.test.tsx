// src/components/ast-render/inline-renderer.test.tsx
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { InlineRenderer } from "./inline-renderer";

vi.mock("@/services/observability/client", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

describe("InlineRenderer наблюдаемость", () => {
  it("логирует неизвестный тип марки через log.warn, а не console", async () => {
    const { log } = await import("@/services/observability/client");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
    render(
      <InlineRenderer
        // @ts-expect-error — намеренно невалидный тип марки для ветки default
        nodes={[{ type: "text", text: "hello", marks: [{ type: "bogus-mark" }] }]}
      />,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("unsupported mark type"),
      expect.objectContaining({ markType: "bogus-mark" }),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

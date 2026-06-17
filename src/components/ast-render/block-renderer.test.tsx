// src/components/ast-render/block-renderer.test.tsx
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { BlockRenderer } from "./block-renderer";

vi.mock("@/services/observability/client", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

const baseCtx = {};

describe("BlockRenderer наблюдаемость", () => {
  it("логирует неизвестный тип блока через log.warn, а не console", async () => {
    const { log } = await import("@/services/observability/client");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    );
    // @ts-expect-error — намеренно невалидный тип блока для ветки default
    render(<BlockRenderer block={{ type: "__unknown__" }} ctx={baseCtx} />);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("unsupported block type"),
      expect.objectContaining({ blockType: "__unknown__" }),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

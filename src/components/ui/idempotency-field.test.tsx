import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/utils/create-action";

import { IdempotencyField } from "./idempotency-field";

afterEach(cleanup);

const ok: ActionResult<unknown> = { success: true, data: null };
const fail: ActionResult<unknown> = { success: false, error: "boom" };

function keyValue(container: HTMLElement): string {
  // eslint-disable-next-line testing-library/no-node-access -- скрытый input без роли/лейбла, RTL-запросом не достать (прецедент: router-link-busy.test.tsx)
  const input = container.querySelector<HTMLInputElement>(
    'input[name="__idempotency_key"]',
  );
  if (!input) throw new Error("hidden field not rendered");
  return input.value;
}

describe("IdempotencyField", () => {
  beforeEach(() => {
    let n = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
      () => `key-${++n}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a hidden field with a generated key", () => {
    const { container } = render(<IdempotencyField result={ok} />);
    expect(keyValue(container)).toBe("key-1");
  });

  it("keeps the key unchanged after a failed submit", () => {
    const { container, rerender } = render(<IdempotencyField result={ok} />);
    const before = keyValue(container);
    rerender(<IdempotencyField result={fail} />);
    expect(keyValue(container)).toBe(before);
  });

  it("rotates the key after a successful submit", () => {
    const { container, rerender } = render(<IdempotencyField result={fail} />);
    const before = keyValue(container);
    rerender(<IdempotencyField result={{ success: true, data: 1 }} />);
    expect(keyValue(container)).not.toBe(before);
  });
});

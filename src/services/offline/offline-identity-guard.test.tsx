import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { reconcileMock } = vi.hoisted(() => ({ reconcileMock: vi.fn() }));
vi.mock("./owner", () => ({ reconcileOfflineOwner: reconcileMock }));

import { OfflineIdentityGuard } from "./offline-identity-guard";

beforeEach(() => {
  reconcileMock.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("OfflineIdentityGuard", () => {
  it("на монтировании сверяет владельца с текущим userId", () => {
    render(<OfflineIdentityGuard userId="alice" />);
    expect(reconcileMock).toHaveBeenCalledWith("alice");
  });

  it("гость (null) → тоже вызывает сверку (решение «не трогать» — внутри неё)", () => {
    render(<OfflineIdentityGuard userId={null} />);
    expect(reconcileMock).toHaveBeenCalledWith(null);
  });

  it("смена userId → повторная сверка с новым значением", () => {
    const { rerender } = render(<OfflineIdentityGuard userId="alice" />);
    rerender(<OfflineIdentityGuard userId="bob" />);
    expect(reconcileMock).toHaveBeenCalledWith("bob");
  });
});

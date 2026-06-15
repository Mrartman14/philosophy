import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const { reconcileMock } = vi.hoisted(() => ({ reconcileMock: vi.fn() }));
vi.mock("./owner", () => ({ reconcileOfflineOwner: reconcileMock }));

import { openIdentityGate, whenIdentityReconciled } from "./identity-gate";
import { OfflineIdentityGuard } from "./offline-identity-guard";

beforeEach(() => {
  reconcileMock.mockReset().mockResolvedValue(undefined);
  openIdentityGate(); // барьер — модульный синглтон, возвращаем к открытому
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

  it("закрывает барьер чтений на рендере и открывает после завершения сверки", async () => {
    let finishReconcile: () => void = () => undefined;
    reconcileMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishReconcile = resolve;
      }),
    );

    render(<OfflineIdentityGuard userId="bob" />);

    // Пока сверка не завершилась — барьер закрыт (чтения ждут).
    let opened = false;
    void whenIdentityReconciled().then(() => {
      opened = true;
    });
    await Promise.resolve();
    expect(opened).toBe(false);

    // Сверка завершилась → барьер открыт.
    finishReconcile();
    await whenIdentityReconciled();
    expect(opened).toBe(true);
  });
});

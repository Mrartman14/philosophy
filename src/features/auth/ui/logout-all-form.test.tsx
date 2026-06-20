import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { LogoutAllForm } from "./logout-all-form";

const { logoutAllMock, wipeMock } = vi.hoisted(() => ({
  logoutAllMock: vi.fn(),
  wipeMock: vi.fn(),
}));

vi.mock("../actions", () => ({ logoutAllAction: logoutAllMock }));
vi.mock("@/services/offline/wipe", () => ({ wipeOfflineData: wipeMock }));

// Мок i18n/client: useT возвращает переводчик по реальным каталогам ru (auth + common).
vi.mock("@/i18n/client", async () => {
  const { default: auth } = await import("@/i18n/messages/ru/auth");
  const common = (await import("@/i18n/messages/ru/common")).default;
  const catalogs: Record<string, unknown> = { auth, common };
  const useT = (ns: string) => {
    const catalog = catalogs[ns] ?? {};
    return (key: string) =>
      key.split(".").reduce<unknown>(
        (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
        catalog,
      ) ?? key;
  };
  return { useT };
});

beforeEach(() => {
  logoutAllMock.mockReset().mockResolvedValue(undefined);
  wipeMock.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

const DIALOG_TITLE = "Выйти со всех устройств?";

describe("LogoutAllForm", () => {
  it("клик на кнопку → показывает диалог подтверждения, logoutAll не вызывается", async () => {
    render(<LogoutAllForm />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти со всех устройств" }));

    await screen.findByText(DIALOG_TITLE);
    expect(logoutAllMock).not.toHaveBeenCalled();
    expect(wipeMock).not.toHaveBeenCalled();
  });

  it("подтверждение «Выйти везде» → чистит кеш и вызывает logoutAll", async () => {
    render(<LogoutAllForm />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти со всех устройств" }));
    const confirm = await screen.findByRole("button", { name: "Выйти везде" });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(logoutAllMock).toHaveBeenCalledOnce();
    });
    expect(wipeMock).toHaveBeenCalledOnce();
  });

  it("«Отмена» → logoutAll не вызывается", async () => {
    render(<LogoutAllForm />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти со всех устройств" }));
    const cancel = await screen.findByRole("button", { name: "Отмена" });
    fireEvent.click(cancel);

    await waitFor(() => {
      expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    });
    expect(logoutAllMock).not.toHaveBeenCalled();
    expect(wipeMock).not.toHaveBeenCalled();
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { LogoutForm } from "./logout-form";

const { logoutMock, wipeMock, countMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  wipeMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("../actions", () => ({ logoutAction: logoutMock }));
vi.mock("@/services/offline/wipe", () => ({ wipeOfflineData: wipeMock }));
vi.mock("@/services/offline/store/saved-bundles", () => ({
  countSavedBundles: countMock,
}));

beforeEach(() => {
  logoutMock.mockReset().mockResolvedValue(undefined);
  wipeMock.mockReset().mockResolvedValue(undefined);
  countMock.mockReset();
});
afterEach(cleanup);

const DIALOG_TITLE = "Выйти из аккаунта?";

describe("LogoutForm", () => {
  it("пустая офлайн-библиотека → «Выйти» сразу чистит кеш и логаутит, без диалога", async () => {
    countMock.mockResolvedValue(0);
    render(<LogoutForm username="alice" />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledOnce();
    });
    expect(wipeMock).toHaveBeenCalledOnce();
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
  });

  it("непустая библиотека → «Выйти» показывает предупреждение, логаут НЕ идёт до подтверждения", async () => {
    countMock.mockResolvedValue(3);
    render(<LogoutForm username="alice" />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));

    await screen.findByText(DIALOG_TITLE);
    expect(logoutMock).not.toHaveBeenCalled();
    expect(wipeMock).not.toHaveBeenCalled();
  });

  it("непустая библиотека → подтверждение «Выйти и удалить» → чистит кеш и логаутит", async () => {
    countMock.mockResolvedValue(3);
    render(<LogoutForm username="alice" />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    const confirm = await screen.findByRole("button", {
      name: "Выйти и удалить",
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledOnce();
    });
    expect(wipeMock).toHaveBeenCalledOnce();
  });

  it("непустая библиотека → «Отмена» → логаут не вызывается", async () => {
    countMock.mockResolvedValue(3);
    render(<LogoutForm username="alice" />);

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    const cancel = await screen.findByRole("button", { name: "Отмена" });
    fireEvent.click(cancel);

    await waitFor(() => {
      expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    });
    expect(logoutMock).not.toHaveBeenCalled();
    expect(wipeMock).not.toHaveBeenCalled();
  });
});

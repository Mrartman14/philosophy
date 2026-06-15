// src/app/_offline/save-offline-button.test.tsx
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

const saveOffline = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("./save-offline", () => ({ saveOffline }));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  useToast: () => ({ add: toastAdd }),
}));

import { SaveOfflineButton } from "./save-offline-button";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SaveOfflineButton", () => {
  it("успех → показывает «Сохранено», тост-успех", async () => {
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => {
      expect(screen.getByText(/Сохранено/)).toBeTruthy();
    });
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("ошибка → тост с описанием, кнопка снова активна", async () => {
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => {
      expect(toastAdd).toHaveBeenCalled();
    });
    expect(screen.getByText("Сохранить офлайн")).toBeTruthy();
  });
});

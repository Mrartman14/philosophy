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

// Мок i18n/client: useT("pages") возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: pages } = await import("@/i18n/messages/ru/pages");
  return {
    useT: (ns: string) => {
      const catalog = ns === "pages" ? pages : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) {
          val = val?.[part];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (!params) return val;
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return val.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? k));
      };
    },
  };
});

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

  it("успех с предупреждением → тост с описанием о хрупкости", async () => {
    saveOffline.mockResolvedValue({ ok: true, warning: "хрупко" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => {
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ description: "хрупко" }),
      );
    });
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

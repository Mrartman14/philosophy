import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ToastProvider } from "@/components/ui";

import { HistoryTrackingToggle } from "./history-tracking-toggle";

const { refreshMock, setTrackingMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setTrackingMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  setHistoryTracking: setTrackingMock,
}));

// Мок @/i18n/client: useT возвращает переводчик по реальным каталогам ru.
vi.mock("@/i18n/client", async () => {
  const { default: statistics } = await import(
    "@/i18n/messages/ru/statistics"
  );
  const { default: errors } = await import("@/i18n/messages/ru/errors");
  return {
    useT: (ns: string) => {
      const catalog = ns === "statistics" ? statistics : ns === "errors" ? errors : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) {
          val = val?.[part];
        }
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (params) {
          return val.replace(/\{(\w+)\}/g, (_: string, k: string) => {
            const v = params[k];
            if (typeof v === "string" || typeof v === "number") return String(v);
            return `{${k}}`;
          });
        }
        return val;
      };
    },
  };
});

function renderToggle(props: { initialEnabled: boolean; canManage: boolean }) {
  return render(
    <ToastProvider>
      <HistoryTrackingToggle {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  refreshMock.mockReset();
  setTrackingMock.mockReset();
});
afterEach(cleanup);

describe("HistoryTrackingToggle", () => {
  it("выключенный трекинг → кнопка «Включить»", () => {
    renderToggle({ initialEnabled: false, canManage: true });
    expect(screen.getByText("Трекинг просмотров выключен.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Включить" })).toBeTruthy();
  });

  it("включённый трекинг → кнопка «Выключить» и статус", () => {
    renderToggle({ initialEnabled: true, canManage: true });
    expect(screen.getByText("Трекинг просмотров включён.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Выключить" })).toBeTruthy();
  });

  it("клик «Включить» → вызывает экшен с true, обновляет состояние и refresh", async () => {
    setTrackingMock.mockResolvedValue({
      success: true,
      data: { tracking_enabled: true },
    });
    renderToggle({ initialEnabled: false, canManage: true });

    fireEvent.click(screen.getByRole("button", { name: "Включить" }));

    await waitFor(() => {
      expect(screen.getByText("Трекинг просмотров включён.")).toBeTruthy();
    });
    expect(setTrackingMock).toHaveBeenCalledWith(true);
    expect(refreshMock).toHaveBeenCalled();
  });

  it("выключение через диалог подтверждения → экшен с false, состояние и refresh", async () => {
    setTrackingMock.mockResolvedValue({
      success: true,
      data: { tracking_enabled: false },
    });
    renderToggle({ initialEnabled: true, canManage: true });

    // 1) открыть диалог по триггеру «Выключить»
    fireEvent.click(screen.getByRole("button", { name: "Выключить" }));
    // 2) подтвердить в диалоге — кнопка с ОТЛИЧНЫМ от триггера лейблом
    //    (ConfirmDialog рендерит контент в портал → findByRole ждёт монтирования)
    const confirm = await screen.findByRole("button", { name: "Удалить историю" });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(screen.getByText("Трекинг просмотров выключен.")).toBeTruthy();
    });
    expect(setTrackingMock).toHaveBeenCalledWith(false);
    expect(refreshMock).toHaveBeenCalled();
  });

  it("forbidden → состояние не меняется, refresh не вызывается", async () => {
    setTrackingMock.mockResolvedValue({
      success: false,
      code: "forbidden",
      error: "forbidden",
    });
    renderToggle({ initialEnabled: false, canManage: true });

    fireEvent.click(screen.getByRole("button", { name: "Включить" }));

    await waitFor(() => {
      expect(setTrackingMock).toHaveBeenCalledWith(true);
    });
    expect(screen.getByText("Трекинг просмотров выключен.")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("canManage=false → кнопка «Включить» задизейблена", () => {
    renderToggle({ initialEnabled: false, canManage: false });
    expect(
      screen.getByRole("button", { name: "Включить" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});

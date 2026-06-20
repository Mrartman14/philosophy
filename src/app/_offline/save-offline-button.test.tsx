import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { OFFLINE_SCHEMA_VERSION } from "@/services/offline/contract/storage";

const saveOffline = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());
const getSavedBundle = vi.hoisted(() => vi.fn());
const deleteSavedBundle = vi.hoisted(() => vi.fn());
const toastAdd = vi.hoisted(() => vi.fn());

vi.mock("./save-offline", () => ({ saveOffline }));
vi.mock("./revalidate-saved-bundle", () => ({ revalidateSavedBundle: revalidate }));
vi.mock("@/services/offline/store/saved-bundles", () => ({
  getSavedBundle,
  deleteSavedBundle,
}));
vi.mock("@/services/offline/identity-gate", () => ({
  whenIdentityReconciled: () => Promise.resolve(),
}));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
  useToast: () => ({ add: toastAdd }),
  ConfirmDialog: ({
    trigger,
    onConfirm,
  }: {
    trigger: ReactNode;
    onConfirm: () => void | Promise<void>;
  }) => (
    <>
      {trigger}
      <button data-testid="confirm-remove" onClick={() => void onConfirm()}>
        confirm
      </button>
    </>
  ),
}));
vi.mock("@/i18n/client", async () => {
  const { default: pages } = await import("@/i18n/messages/ru/pages");
  return {
    useT: (ns: string) => {
      const catalog = ns === "pages" ? pages : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) val = val?.[part];
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

const complete = (over: Record<string, unknown> = {}) => ({
  entity: "lectures",
  id: "l1",
  key: "lectures:l1",
  savedAt: "2026-06-10T00:00:00.000Z",
  schemaVersion: OFFLINE_SCHEMA_VERSION,
  status: "complete",
  snapshot: {},
  imageKeys: [],
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

describe("SaveOfflineButton", () => {
  it("нет копии → «Сохранить офлайн», ревалидация не зовётся", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Сохранить офлайн")).toBeTruthy();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("есть свежая копия → бейдж «Сохранено» + «Удалить копию»", async () => {
    getSavedBundle.mockResolvedValue(complete());
    revalidate.mockResolvedValue("fresh");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText(/Сохранено офлайн/)).toBeTruthy();
    expect(screen.getByText("Удалить копию")).toBeTruthy();
    expect(revalidate).toHaveBeenCalledWith("lectures", "l1");
  });

  it("ревалидация → stale: «Доступно обновление» + «Обновить»", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Доступно обновление")).toBeTruthy();
    expect(screen.getByText("Обновить")).toBeTruthy();
  });

  it("клик «Сохранить офлайн» → saveOffline, затем бейдж", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Сохранить офлайн")).toBeTruthy();
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    expect(await screen.findByText(/Сохранено офлайн/)).toBeTruthy();
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("клик «Обновить» → saveOffline, затем свежий бейдж", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    saveOffline.mockResolvedValue({ ok: true });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Обновить")).toBeTruthy();
    fireEvent.click(screen.getByText("Обновить"));
    expect(await screen.findByText(/Сохранено офлайн/)).toBeTruthy();
    expect(saveOffline).toHaveBeenCalledWith("lectures", "l1");
  });

  it("удаление → deleteSavedBundle, возврат к «Сохранить офлайн»", async () => {
    getSavedBundle.mockResolvedValue(complete());
    revalidate.mockResolvedValue("fresh");
    deleteSavedBundle.mockResolvedValue(undefined);
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Удалить копию")).toBeTruthy();
    fireEvent.click(screen.getByTestId("confirm-remove"));
    expect(await screen.findByText("Сохранить офлайн")).toBeTruthy();
    expect(deleteSavedBundle).toHaveBeenCalledWith("lectures", "l1");
  });

  it("сбой удаления → возврат к «Сохранено», тост ошибки", async () => {
    getSavedBundle.mockResolvedValue(complete());
    revalidate.mockResolvedValue("fresh");
    deleteSavedBundle.mockRejectedValue(new Error("idb"));
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    await screen.findByText("Удалить копию");
    fireEvent.click(screen.getByTestId("confirm-remove"));
    await waitFor(() => {
      expect(toastAdd).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Сохранено офлайн/)).toBeTruthy();
  });

  it("оффлайн → ревалидация не зовётся, показывает последний статус", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    getSavedBundle.mockResolvedValue(complete({ remoteStatus: "stale" }));
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Доступно обновление")).toBeTruthy();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("ошибка сохранения → тост, кнопка снова «Сохранить офлайн»", async () => {
    getSavedBundle.mockResolvedValue(undefined);
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Сохранить офлайн")).toBeTruthy();
    fireEvent.click(screen.getByText("Сохранить офлайн"));
    await waitFor(() => { expect(toastAdd).toHaveBeenCalled(); });
    expect(screen.getByText("Сохранить офлайн")).toBeTruthy();
  });

  it("ревалидация → gone: бейдж «Сохранено» (копия цела), не падает", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "gone" }));
    revalidate.mockResolvedValue("gone");
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText(/Сохранено офлайн/)).toBeTruthy();
    expect(screen.getByText("Удалить копию")).toBeTruthy();
  });

  it("сбой «Обновить» → откат в stale, кнопка «Обновить» остаётся", async () => {
    getSavedBundle
      .mockResolvedValueOnce(complete())
      .mockResolvedValueOnce(complete({ remoteStatus: "stale" }));
    revalidate.mockResolvedValue("stale");
    saveOffline.mockResolvedValue({ ok: false, error: "нет сети" });
    render(<SaveOfflineButton entity="lectures" id="l1" />);
    expect(await screen.findByText("Обновить")).toBeTruthy();
    fireEvent.click(screen.getByText("Обновить"));
    await waitFor(() => { expect(toastAdd).toHaveBeenCalled(); });
    expect(screen.getByText("Обновить")).toBeTruthy();
  });
});

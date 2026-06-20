import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

// ConfirmDialog тянет useT("common") внутри — мокаем client-фасад на реальный
// ru-каталог (резолв dotted-ключа `confirmDialog.confirm` без next-intl-провайдера).
vi.mock("@/i18n/client", async () => {
  const common = (await import("@/i18n/messages/ru/common")).default;
  const useT = () => (key: string) =>
    key.split(".").reduce<unknown>((acc, k) =>
      (acc as Record<string, unknown> | undefined)?.[k], common) ?? key;
  return { useT };
});

import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("без shouldConfirm: триггер открывает диалог; подтверждение зовёт onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<button>Удалить</button>}
        title="Удалить?"
        confirmLabel="Да, удалить"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    fireEvent.click(await screen.findByRole("button", { name: "Да, удалить" }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it("shouldConfirm → true: открывает диалог, onConfirm только после подтверждения", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<button>Выйти</button>}
        title="Точно?"
        confirmLabel="Да"
        onConfirm={onConfirm}
        shouldConfirm={() => true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    await screen.findByText("Точно?");
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Да" }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  it("shouldConfirm → false: пропускает диалог, сразу зовёт onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<button>Выйти</button>}
        title="Точно?"
        onConfirm={onConfirm}
        shouldConfirm={() => false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
    expect(screen.queryByText("Точно?")).toBeNull();
  });

  it("shouldConfirm бросает → fail-safe: показывает диалог, onConfirm не зовётся", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<button>Выйти</button>}
        title="Точно?"
        onConfirm={onConfirm}
        shouldConfirm={() => {
          throw new Error("boom");
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    await screen.findByText("Точно?");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("повторный клик во время async shouldConfirm не дублирует проверку/действие", async () => {
    let resolve!: (v: boolean) => void;
    const shouldConfirm = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          resolve = r;
        }),
    );
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<button>Выйти</button>}
        title="Точно?"
        onConfirm={onConfirm}
        shouldConfirm={shouldConfirm}
      />,
    );
    const btn = screen.getByRole("button", { name: "Выйти" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    resolve(false);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce();
    });
    expect(shouldConfirm).toHaveBeenCalledOnce();
  });
});

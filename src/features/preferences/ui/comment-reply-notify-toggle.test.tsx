import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ToastProvider } from "@/components/ui";

import { CommentReplyNotifyToggle } from "./comment-reply-notify-toggle";

const { refreshMock, setMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("../actions", () => ({
  setNotifyOnCommentReply: setMock,
}));

vi.mock("@/i18n/client", async () => {
  const { default: preferences } = await import("@/i18n/messages/ru/preferences");
  const { default: errors } = await import("@/i18n/messages/ru/errors");
  return {
    useT: (ns: string) => {
      const catalog = ns === "preferences" ? preferences : ns === "errors" ? errors : {};
      return (key: string, params?: Record<string, unknown>) => {
        const parts = key.split(".");
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        let val: any = catalog;
        for (const part of parts) val = val?.[part];
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        if (typeof val !== "string") return key;
        if (params) {
          return val.replace(/\{(\w+)\}/g, (_: string, k: string) => {
            const v = params[k];
            return typeof v === "string" || typeof v === "number" ? String(v) : `{${k}}`;
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
      <CommentReplyNotifyToggle {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  refreshMock.mockReset();
  setMock.mockReset();
  setMock.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe("CommentReplyNotifyToggle", () => {
  it("оптимистично флипает и зовёт экшен с новым значением", async () => {
    renderToggle({ initialEnabled: true, canManage: true });
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();

    fireEvent.click(box);

    await waitFor(() => {
      expect(setMock).toHaveBeenCalledWith(false);
    });
    expect(box).not.toBeChecked();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("откатывает состояние при ошибке экшена", async () => {
    setMock.mockResolvedValue({ success: false, code: "SUSPENDED" });
    renderToggle({ initialEnabled: false, canManage: true });
    const box = screen.getByRole("checkbox");

    fireEvent.click(box);

    await waitFor(() => {
      expect(setMock).toHaveBeenCalledWith(true);
    });
    // откат: значение вернулось к исходному false
    await waitFor(() => {
      expect(box).not.toBeChecked();
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("disabled, когда canManage=false", () => {
    renderToggle({ initialEnabled: true, canManage: false });
    // Base UI Checkbox рендерит <span role="checkbox"> и помечает выключенное
    // состояние aria-disabled (не нативным disabled) — как radio-group.test.tsx.
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-disabled", "true");
  });
});

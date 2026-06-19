import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useRegisterSWMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-register-sw", () => ({ useRegisterSW: useRegisterSWMock }));

// Мок @/i18n/client: useT возвращает переводчик по реальному каталогу ru.
vi.mock("@/i18n/client", async () => {
  const { default: common } = await import("@/i18n/messages/ru/common");
  return {
    useT: (_ns: string) => (key: string) => {
      const parts = key.split(".");
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      let val: any = common;
      for (const part of parts) val = val?.[part];
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      return typeof val === "string" ? val : key;
    },
  };
});

import { UpdatePrompt } from "./update-prompt";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UpdatePrompt", () => {
  it("нет апдейта → ничего не показывает", () => {
    useRegisterSWMock.mockReturnValue({
      needsUpdate: false,
      applyUpdate: vi.fn(),
    });
    render(<UpdatePrompt />);
    expect(screen.queryByText("Доступно обновление")).toBeNull();
  });

  it("есть апдейт → показывает плашку; клик «Обновить» зовёт applyUpdate", () => {
    const applyUpdate = vi.fn();
    useRegisterSWMock.mockReturnValue({ needsUpdate: true, applyUpdate });
    render(<UpdatePrompt />);
    expect(screen.getByText("Доступно обновление")).toBeTruthy();

    fireEvent.click(screen.getByText("Обновить"));
    expect(applyUpdate).toHaveBeenCalledOnce();
  });
});

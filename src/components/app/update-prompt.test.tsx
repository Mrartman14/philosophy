import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useRegisterSWMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-register-sw", () => ({ useRegisterSW: useRegisterSWMock }));

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

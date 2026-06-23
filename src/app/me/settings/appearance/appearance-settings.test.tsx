import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setAxis = vi.fn();
vi.mock("@/components/appearance", () => ({
  useAppearance: () => ({
    appearance: { theme: "light", contrast: "auto", density: "comfortable", font: "sans", textSize: "md", motion: "system" },
    setAxis,
  }),
}));

const withViewTransition = vi.fn((fn: () => void) => { fn(); });
vi.mock("@/utils/view-transition", () => ({ withViewTransition: (fn: () => void) => { withViewTransition(fn); } }));

vi.mock("@/i18n/client", async () => {
  const settings = (await import("@/i18n/messages/ru/settings")).default;
  const useT = () => (key: string) =>
    (key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], settings) ?? key) as string;
  return { useT };
});

import { AppearanceSettings } from "./appearance-settings";

afterEach(() => { cleanup(); setAxis.mockClear(); withViewTransition.mockClear(); });

describe("AppearanceSettings", () => {
  // Примечание: внутри FormField/Field.Label у Base UI каждый radio получает
  // aria-labelledby группового лейбла, поэтому accessible name всех сегментов
  // = имя группы ("Тема"/"Плотность"). Конкретный сегмент адресуем по видимому
  // тексту опции (getByText), который рендерится прямо на role="radio".
  it("смена темы идёт через withViewTransition и setAxis('theme')", () => {
    render(<AppearanceSettings />);
    const group = screen.getByRole("radiogroup", { name: /тем/i });
    fireEvent.click(within(group).getByText(/тёмн/i));
    expect(withViewTransition).toHaveBeenCalledTimes(1);
    expect(setAxis).toHaveBeenCalledWith("theme", "dark");
  });

  it("смена плотности — напрямую setAxis, без withViewTransition", () => {
    render(<AppearanceSettings />);
    const group = screen.getByRole("radiogroup", { name: /плотн/i });
    fireEvent.click(within(group).getByText(/компакт/i));
    expect(setAxis).toHaveBeenCalledWith("density", "compact");
    expect(withViewTransition).not.toHaveBeenCalled();
  });

  it("размер текста — radiogroup; выбор сегмента зовёт setAxis('textSize')", () => {
    render(<AppearanceSettings />);
    const group = screen.getByRole("radiogroup", { name: /размер текста/i });
    // Сегменты подписаны локализованным текстом (sr-only), визуал — глиф «Aa».
    fireEvent.click(within(group).getByText(/крупнее/i));
    expect(setAxis).toHaveBeenCalledWith("textSize", "lg");
  });
});

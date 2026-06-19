import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Мок лист-иконки: тестируем логику индикатора (показ/скрытие + проброс className),
// а не внутренности OfflineIcon. data-testid → testing-library-совместимые запросы.
vi.mock("@/assets/icons/offline-icon", () => ({
  OfflineIcon: ({
    className,
    ...props
  }: { className?: string } & React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="offline-icon" className={className} {...props} />
  ),
}));

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

import { NetworkIndicator } from "./network-indicator";

// navigator.onLine в jsdom — getter на прототипе; шадуим своим управляемым.
let online = true;

beforeEach(() => {
  online = true;
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator as object, "onLine");
});

describe("NetworkIndicator", () => {
  it("офлайн → показывает иконку", () => {
    online = false;
    render(<NetworkIndicator />);
    expect(screen.getByTestId("offline-icon")).toBeTruthy();
  });

  it("онлайн → иконка не рендерится, но live-регион присутствует", () => {
    online = true;
    render(<NetworkIndicator />);
    expect(screen.queryByTestId("offline-icon")).toBeNull();
    // Live-регион всегда смонтирован, чтобы объявлять переход «онлайн → офлайн»
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Нет сети")).toBeNull();
  });

  it("реагирует на событие offline → иконка появляется", () => {
    online = true;
    render(<NetworkIndicator />);
    expect(screen.queryByTestId("offline-icon")).toBeNull();
    act(() => {
      online = false;
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("offline-icon")).toBeTruthy();
  });

  it("прокидывает className на иконку (офлайн)", () => {
    online = false;
    render(<NetworkIndicator className="indicator-cls" />);
    expect(screen.getByTestId("offline-icon").className).toContain(
      "indicator-cls",
    );
  });

  // a11y: live-регион и sr-only текст
  it("a11y: live-регион role=status всегда смонтирован", () => {
    online = true;
    render(<NetworkIndicator />);
    const region = screen.getByRole("status");
    expect(region).toBeTruthy();
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("a11y: офлайн → sr-only текст «Нет сети» в live-регионе", () => {
    online = false;
    render(<NetworkIndicator />);
    const region = screen.getByRole("status");
    expect(region.textContent).toContain("Нет сети");
  });

  it("a11y: офлайн → иконка помечена aria-hidden (не несёт доступного имени)", () => {
    online = false;
    render(<NetworkIndicator />);
    const icon = screen.getByTestId("offline-icon");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("a11y: онлайн → live-регион пуст (нет текста «Нет сети»)", () => {
    online = true;
    render(<NetworkIndicator />);
    const region = screen.getByRole("status");
    expect(region.textContent).not.toContain("Нет сети");
  });

  it("a11y: переход офлайн → online убирает sr-only текст из live-региона", () => {
    online = false;
    render(<NetworkIndicator />);
    expect(screen.getByRole("status").textContent).toContain("Нет сети");
    act(() => {
      online = true;
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByRole("status").textContent).not.toContain("Нет сети");
  });
});

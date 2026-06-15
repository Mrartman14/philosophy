import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Мок лист-иконки: тестируем логику индикатора (показ/скрытие + проброс className),
// а не внутренности OfflineIcon. data-testid → testing-library-совместимые запросы.
vi.mock("@/assets/icons/offline-icon", () => ({
  OfflineIcon: ({ className }: { className?: string }) => (
    <span data-testid="offline-icon" className={className} />
  ),
}));

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

  it("онлайн → ничего не рендерит", () => {
    online = true;
    render(<NetworkIndicator />);
    expect(screen.queryByTestId("offline-icon")).toBeNull();
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
});

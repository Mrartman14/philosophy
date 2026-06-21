import { cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TimezoneProvider, useTz } from "./timezone-provider";

function Probe() {
  return <span data-testid="tz">{useTz()}</span>;
}

beforeEach(() => {
  Object.defineProperty(document, "cookie", { writable: true, value: "" });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TimezoneProvider", () => {
  it("первый рендер использует серверный resolved (без коррекции для concrete pref)", () => {
    render(
      <TimezoneProvider initial={{ pref: "Asia/Tokyo", resolved: "Asia/Tokyo" }}>
        <Probe />
      </TimezoneProvider>,
    );
    expect(screen.getByTestId("tz").textContent).toBe("Asia/Tokyo");
  });

  it("system: после mount уточняет браузерную зону и пишет cookie", () => {
    // Конструктор-стиль (function): isValidZone делает `new Intl.DateTimeFormat`,
    // а стрелочный mock с `new` бросает → зона считалась бы невалидной.
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function () {
      return { resolvedOptions: () => ({ timeZone: "America/New_York" }) };
    } as unknown as typeof Intl.DateTimeFormat);
    render(
      <TimezoneProvider initial={{ pref: "system", resolved: "Europe/Moscow" }}>
        <Probe />
      </TimezoneProvider>,
    );
    expect(screen.getByTestId("tz").textContent).toBe("America/New_York");
    expect(document.cookie).toContain("tz=");
  });

  it("system: браузерная зона совпала с resolved → cookie не пишется", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function () {
      return { resolvedOptions: () => ({ timeZone: "Europe/Moscow" }) };
    } as unknown as typeof Intl.DateTimeFormat);
    render(
      <TimezoneProvider initial={{ pref: "system", resolved: "Europe/Moscow" }}>
        <Probe />
      </TimezoneProvider>,
    );
    expect(screen.getByTestId("tz").textContent).toBe("Europe/Moscow");
    expect(document.cookie).toBe("");
  });

  it("useTz вне провайдера → фолбэк", () => {
    render(<Probe />);
    expect(screen.getByTestId("tz").textContent).toBe("Europe/Moscow");
  });
});

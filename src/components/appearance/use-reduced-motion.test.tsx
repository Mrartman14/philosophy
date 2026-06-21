import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { AppearanceProvider } from "./appearance-provider";
import { useReducedMotion } from "./use-reduced-motion";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

// Управляемый matchMedia: mutable matches + реестр change-листенеров,
// чтобы тестировать и статическое значение, и live OS-переключение.
let mqMatches = false;
let mqListeners: Array<() => void> = [];
function stubMatchMedia(matches: boolean) {
  mqMatches = matches;
  mqListeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("prefers-reduced-motion") ? mqMatches : false; },
    media: query,
    addEventListener: (_: string, cb: () => void) => { mqListeners.push(cb); },
    removeEventListener: (_: string, cb: () => void) => { mqListeners = mqListeners.filter((l) => l !== cb); },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}
function fireOSChange(matches: boolean) {
  mqMatches = matches;
  mqListeners.forEach((cb) => { cb(); });
}

function Probe() {
  return <span data-testid="r">{String(useReducedMotion())}</span>;
}
function renderWith(motion: "system" | "reduced" | "full") {
  render(
    <AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, motion }}>
      <Probe />
    </AppearanceProvider>,
  );
  return screen.getByTestId("r").textContent;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useReducedMotion", () => {
  beforeEach(() => { stubMatchMedia(false); });

  it("reduced → true regardless of OS", () => {
    stubMatchMedia(false);
    expect(renderWith("reduced")).toBe("true");
  });
  it("full → false even when OS asks reduce", () => {
    stubMatchMedia(true);
    expect(renderWith("full")).toBe("false");
  });
  it("system follows OS: off", () => {
    stubMatchMedia(false);
    expect(renderWith("system")).toBe("false");
  });
  it("system follows OS: on", () => {
    stubMatchMedia(true);
    expect(renderWith("system")).toBe("true");
  });
  it("system reacts to a live OS change (subscribe → re-render)", () => {
    stubMatchMedia(false);
    renderWith("system");
    expect(screen.getByTestId("r").textContent).toBe("false");
    act(() => { fireOSChange(true); });
    expect(screen.getByTestId("r").textContent).toBe("true");
  });
});

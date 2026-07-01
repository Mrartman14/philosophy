import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWide, WIDE_MEDIA } from "./use-wide";

// Управляемый matchMedia: mutable matches + реестр change-листенеров (паттерн
// use-reduced-motion.test): тестируем и начальное значение, и live-переключение.
let mqMatches = false;
let mqListeners: (() => void)[] = [];
function stubMatchMedia(matches: boolean) {
  mqMatches = matches;
  mqListeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === WIDE_MEDIA ? mqMatches : false;
    },
    media: query,
    addEventListener: (_: string, cb: () => void) => {
      mqListeners.push(cb);
    },
    removeEventListener: (_: string, cb: () => void) => {
      mqListeners = mqListeners.filter((l) => l !== cb);
    },
    dispatchEvent: () => false,
    onchange: null,
  }));
}
function fireChange(matches: boolean) {
  mqMatches = matches;
  mqListeners.forEach((cb) => {
    cb();
  });
}

function Probe() {
  return <span data-testid="w">{String(useWide())}</span>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useWide", () => {
  it("без matchMedia (jsdom) → false, не бросает", () => {
    // jsdom по умолчанию не определяет window.matchMedia.
    expect(() => {
      render(<Probe />);
    }).not.toThrow();
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("matchMedia.matches=true → поднимает wide после mount", () => {
    stubMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("matchMedia.matches=false → остаётся false", () => {
    stubMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("реагирует на live-смену media (subscribe → re-render)", () => {
    stubMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
    act(() => {
      fireChange(true);
    });
    expect(screen.getByTestId("w").textContent).toBe("true");
  });
});

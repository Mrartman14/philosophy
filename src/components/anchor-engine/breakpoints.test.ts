import { afterEach, describe, expect, it, vi } from "vitest";

import { isMarginaliaWide } from "./breakpoints";

// isMarginaliaWide зеркалит CSS `@container page-shell (min-width: 80em)`: меряет
// inline-size .page-shell против порог(em из --container-marginalia) × font-size
// контейнера. jsdom не делает layout → clientWidth/getComputedStyle стабим.

function setupShell(opts: {
  clientWidth: number;
  fontSizePx: number;
  thresholdEm?: string;
}) {
  const shell = document.createElement("div");
  shell.className = "page-shell";
  document.body.appendChild(shell);
  Object.defineProperty(shell, "clientWidth", {
    value: opts.clientWidth,
    configurable: true,
  });
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (el: Element) =>
      (el === shell
        ? {
            fontSize: `${opts.fontSizePx}px`,
            getPropertyValue: (p: string) =>
              p === "--container-marginalia" ? (opts.thresholdEm ?? "80em") : "",
          }
        : { fontSize: "16px", getPropertyValue: () => "" }) as unknown as CSSStyleDeclaration,
  );
  return shell;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("isMarginaliaWide (container-детект wide-гейта)", () => {
  it("нет .page-shell → false (SSR/inline-фолбэк)", () => {
    expect(isMarginaliaWide()).toBe(false);
  });

  it("ширина ≥ 80em×fontSize → wide (scale 1: 1280 ≥ 80×16)", () => {
    setupShell({ clientWidth: 1280, fontSizePx: 16 });
    expect(isMarginaliaWide()).toBe(true);
  });

  it("ширина < порога → narrow", () => {
    setupShell({ clientWidth: 1279, fontSizePx: 16 });
    expect(isMarginaliaWide()).toBe(false);
  });

  it("SCALE-ИНВАРИАНТНОСТЬ: увеличенный font-size поднимает порог (та же ширина → narrow)", () => {
    // scale 1.25 → fontSize 20px → порог 80×20=1600px. Ширина 1280 (была wide при
    // scale 1) больше НЕ дотягивает — ровно то, что делает @container(80em), и чего
    // вьюпортный matchMedia(80rem=1280px всегда) не умел. Это и есть суть фикса.
    setupShell({ clientWidth: 1280, fontSizePx: 20 });
    expect(isMarginaliaWide()).toBe(false);
    // а при 1600 при том же scale — снова wide.
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    setupShell({ clientWidth: 1600, fontSizePx: 20 });
    expect(isMarginaliaWide()).toBe(true);
  });

  it("нечитаемый токен → false, не бросает", () => {
    setupShell({ clientWidth: 2000, fontSizePx: 16, thresholdEm: "" });
    expect(isMarginaliaWide()).toBe(false);
  });
});

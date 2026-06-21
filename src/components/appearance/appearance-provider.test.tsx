import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { AppearanceProvider, useAppearance } from "./appearance-provider";
import { persistAppearance } from "./persist-appearance";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

function Probe() {
  const { appearance, setAxis } = useAppearance();
  return (<>
    <span data-testid="theme">{appearance.theme}</span>
    <button onClick={() => { setAxis("theme", "dark"); }}>dark</button>
    <button onClick={() => { setAxis("theme", "system"); }}>system</button>
    <button onClick={() => { setAxis("density", "compact"); }}>compact</button>
    <button onClick={() => { setAxis("motion", "reduced"); }}>reduce</button>
    <button onClick={() => { setAxis("motion", "system"); }}>motion-system</button>
  </>);
}

afterEach(cleanup);

describe("AppearanceProvider", () => {
  beforeEach(() => { vi.mocked(persistAppearance).mockClear(); document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-density"); document.documentElement.removeAttribute("data-contrast"); document.documentElement.removeAttribute("data-font"); document.documentElement.removeAttribute("data-motion"); document.documentElement.style.colorScheme = ""; document.documentElement.style.removeProperty("--text-scale"); document.cookie = "appearance=; path=/; max-age=0"; });
  it("exposes initial", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); expect(screen.getByTestId("theme").textContent).toBe("system"); });
  it("setAxis mutates <html> + state", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("dark")); expect(document.documentElement.getAttribute("data-theme")).toBe("dark"); expect(screen.getByTestId("theme").textContent).toBe("dark"); });
  it("explicit→system removes data-theme + sets color-scheme", () => { render(<AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, theme: "dark" }}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("system")); expect(document.documentElement.hasAttribute("data-theme")).toBe(false); expect(document.documentElement.style.colorScheme).toBe("light dark"); });
  it("writes cookie", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("compact")); expect(document.cookie).toContain("appearance="); });
  it("seeds the cookie on mount when absent (e.g. backend-seeded initial)", () => {
    render(<AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, theme: "dark" }}><Probe/></AppearanceProvider>);
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"dark"');
  });
  it("does NOT overwrite an existing cookie on mount", () => {
    document.cookie = `appearance=${encodeURIComponent(JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "light" }))}; path=/`;
    render(<AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, theme: "dark" }}><Probe/></AppearanceProvider>);
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"light"');
  });
  it("debounces backend persist: a burst of changes → one PATCH with the latest snapshot", () => {
    vi.useFakeTimers();
    try {
      render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>);
      fireEvent.click(screen.getByText("dark"));
      fireEvent.click(screen.getByText("compact"));
      expect(persistAppearance).not.toHaveBeenCalled(); // still inside the debounce window
      vi.advanceTimersByTime(500);
      expect(persistAppearance).toHaveBeenCalledTimes(1);
      expect(persistAppearance).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme: "dark", density: "compact" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("setAxis motion: reduced sets data-motion, system removes it", () => {
    render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>);
    fireEvent.click(screen.getByText("reduce"));
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    fireEvent.click(screen.getByText("motion-system"));
    expect(document.documentElement.hasAttribute("data-motion")).toBe(false);
  });
});

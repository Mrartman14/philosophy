import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APPEARANCE } from "./appearance-cookie";
import { AppearanceProvider, useAppearance } from "./appearance-provider";

vi.mock("./persist-appearance", () => ({ persistAppearance: vi.fn() }));

function Probe() {
  const { appearance, setAxis } = useAppearance();
  return (<>
    <span data-testid="theme">{appearance.theme}</span>
    <button onClick={() => { setAxis("theme", "dark"); }}>dark</button>
    <button onClick={() => { setAxis("theme", "system"); }}>system</button>
    <button onClick={() => { setAxis("density", "compact"); }}>compact</button>
  </>);
}

afterEach(cleanup);

describe("AppearanceProvider", () => {
  beforeEach(() => { document.documentElement.removeAttribute("data-theme"); document.documentElement.removeAttribute("data-density"); document.documentElement.removeAttribute("data-contrast"); document.documentElement.removeAttribute("data-font"); document.documentElement.style.colorScheme = ""; document.documentElement.style.removeProperty("--text-scale"); document.cookie = ""; });
  it("exposes initial", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); expect(screen.getByTestId("theme").textContent).toBe("system"); });
  it("setAxis mutates <html> + state", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("dark")); expect(document.documentElement.getAttribute("data-theme")).toBe("dark"); expect(screen.getByTestId("theme").textContent).toBe("dark"); });
  it("explicit→system removes data-theme + sets color-scheme", () => { render(<AppearanceProvider initial={{ ...DEFAULT_APPEARANCE, theme: "dark" }}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("system")); expect(document.documentElement.hasAttribute("data-theme")).toBe(false); expect(document.documentElement.style.colorScheme).toBe("light dark"); });
  it("writes cookie", () => { render(<AppearanceProvider initial={DEFAULT_APPEARANCE}><Probe/></AppearanceProvider>); fireEvent.click(screen.getByText("compact")); expect(document.cookie).toContain("appearance="); });
});

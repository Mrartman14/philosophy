import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Реальную геометрию container-детекта тестирует breakpoints.test — здесь
// isMarginaliaWide управляемый, проверяем что хук ОТРАЖАЕТ значение и ПЕРЕЧИТЫВАЕТ
// его по обоим каналам: window.resize (смена ширины) и мутация <html> (смена
// --text-scale двигает порог без ресайза → ResizeObserver бы это пропустил).
let wideState = false;
vi.mock("./breakpoints", () => ({
  PAGE_SHELL_SELECTOR: ".page-shell",
  isMarginaliaWide: () => wideState,
}));

import { useWide } from "./use-wide";

function Probe() {
  return <span data-testid="w">{String(useWide())}</span>;
}

afterEach(() => {
  cleanup();
  wideState = false;
  document.body.innerHTML = "";
});

describe("useWide", () => {
  it("narrow/SSR (isMarginaliaWide=false) → false, не бросает", () => {
    wideState = false;
    expect(() => {
      render(<Probe />);
    }).not.toThrow();
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("isMarginaliaWide=true → поднимает wide после mount", () => {
    wideState = true;
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("перечитывает на window resize (ширина контейнера пересекла порог)", () => {
    wideState = false;
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
    wideState = true;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("перечитывает на мутацию <html> (смена --text-scale двигает порог без ресайза)", async () => {
    wideState = true;
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
    wideState = false;
    await act(async () => {
      document.documentElement.setAttribute("data-text-scale", "1.25");
      // MutationObserver доставляет записи на микротаске — дать ей отработать.
      await Promise.resolve();
    });
    expect(screen.getByTestId("w").textContent).toBe("false");
  });
});

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWide, WIDE_EM } from "./use-wide";

// useWide детектит РАСКРЫТИЕ полей маргиналий так же, как CSS @container
// page-shell (min-width: 80em): «поле открыто ⟺ inline-size контейнера ≥
// 80 × его font-size(px)». Оба множителя масштабируются --text-scale (root
// font-size), поэтому порог scale-инвариантен — тест эмулирует крупный текст,
// увеличивая fontSize контейнера, и проверяет, что порог в px едет синхронно.
//
// jsdom не считает layout: clientWidth=0, нет ResizeObserver, getComputedStyle
// не даёт реальный font-size. Стабим все три программно (паттерн
// clampable-content.test): clientWidth через геттер прототипа, fontSize через
// стаб getComputedStyle, ResizeObserver — класс с реестром колбэков, чтобы
// эмулировать resize/смену --text-scale live.
let containerWidth = 0;
let containerFontPx = 16;
let roCallbacks: (() => void)[] = [];

function setContainer(widthPx: number, fontPx: number) {
  containerWidth = widthPx;
  containerFontPx = fontPx;
}

function fireResize(widthPx: number, fontPx: number) {
  containerWidth = widthPx;
  containerFontPx = fontPx;
  roCallbacks.forEach((cb) => {
    cb();
  });
}

beforeEach(() => {
  containerWidth = 0;
  containerFontPx = 16;
  roCallbacks = [];
  // clientWidth: только для .page-shell отдаём стабовую ширину, иначе 0.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("page-shell") ? containerWidth : 0;
    },
  });
  // getComputedStyle: для .page-shell отдаём стабовый font-size (эмуляция
  // --text-scale через смену containerFontPx), для прочих — реальная jsdom-реализация.
  const realGCS = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (el: Element, pseudo?: string | null) => {
    if (el instanceof HTMLElement && el.classList.contains("page-shell")) {
      return { fontSize: `${containerFontPx}px` } as CSSStyleDeclaration;
    }
    return realGCS(el, pseudo ?? undefined);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        roCallbacks.push(cb);
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error снять override прототипа (вернётся реализация jsdom)
  delete HTMLElement.prototype.clientWidth;
});

// Probe рендерит size-контейнер (.page-shell), внутри которого хук ищет его через
// querySelector — как реальный <main class="page-shell"> в layout.
function Probe() {
  return (
    <main className="page-shell">
      <span data-testid="w">{String(useWide())}</span>
    </main>
  );
}

// Probe без size-контейнера: хук не найдёт .page-shell → безопасный дефолт false.
function ProbeNoContainer() {
  return <span data-testid="w2">{String(useWide())}</span>;
}

describe("useWide (scale-инвариантный container-детект)", () => {
  it("экспортирует порог WIDE_EM = 80", () => {
    expect(WIDE_EM).toBe(80);
  });

  it("контейнер шире порога (≥ 80 × font) → wide=true", () => {
    setContainer(1280, 16); // 1280 ≥ 80 × 16 = 1280
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("контейнер уже порога → wide=false", () => {
    setContainer(1279, 16); // 1279 < 1280
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("scale-инвариантность: крупный текст сдвигает порог в px (тот же width теперь узок)", () => {
    // При --text-scale 1.25 font контейнера ≈ 20px → порог = 80 × 20 = 1600px.
    // Ширина 1280 (была wide при scale 1) теперь НИЖЕ порога → wide=false.
    setContainer(1280, 20);
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("scale-инвариантность: крупный текст + пропорционально шире → снова wide", () => {
    setContainer(1600, 20); // 1600 ≥ 80 × 20 = 1600
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("реагирует на live-resize контейнера (ResizeObserver → re-render)", () => {
    setContainer(1000, 16); // узко
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("false");
    act(() => {
      fireResize(1400, 16); // стало широко
    });
    expect(screen.getByTestId("w").textContent).toBe("true");
  });

  it("реагирует на смену --text-scale (RO-колбэк перечитывает font-size)", () => {
    setContainer(1400, 16); // 1400 ≥ 1280 → wide при scale 1
    render(<Probe />);
    expect(screen.getByTestId("w").textContent).toBe("true");
    act(() => {
      fireResize(1400, 20); // scale 1.25: порог 1600 > 1400 → перестаёт быть wide
    });
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("нет ResizeObserver (jsdom по умолчанию) → false, не бросает", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    setContainer(9999, 16); // даже сверх-широко — без RO остаёмся на безопасном дефолте
    expect(() => {
      render(<Probe />);
    }).not.toThrow();
    expect(screen.getByTestId("w").textContent).toBe("false");
  });

  it("нет контейнера .page-shell в DOM → false", () => {
    setContainer(9999, 16);
    render(<ProbeNoContainer />);
    expect(screen.getByTestId("w2").textContent).toBe("false");
  });
});

// src/components/ast-toc/ast-toc.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AstToc } from "./ast-toc";
import type { HeadingEntry } from "./extract-headings";

// useReducedMotion завязан на AppearanceProvider-контекст; в юнит-тесте мокаем
// его как чистую функцию. Значение управляется через мутабельный контейнер,
// поднятый vi.hoisted (vi.mock-фабрика не может ссылаться на обычные let).
const mock = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/components/appearance", () => ({
  useReducedMotion: () => mock.reduced,
}));

// jsdom не реализует IntersectionObserver — подменяем, захватывая колбэк.
// noop-методы помечены void-выражением, чтобы не триггерить no-empty-function.
class MockIO {
  static last: MockIO | null = null;
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIO.last = this;
  }
  observe() {
    void 0;
  }
  unobserve() {
    void 0;
  }
  disconnect() {
    void 0;
  }
}

const HEADINGS: HeadingEntry[] = [
  { id: "h-a", level: 1, text: "Введение" },
  { id: "h-b", level: 2, text: "Детали" },
];

beforeEach(() => {
  mock.reduced = false;
  MockIO.last = null;
  (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver })
    .IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
});

// Конфиг проекта: globals:false без restoreMocks → авто-cleanup RTL НЕ работает.
// Чистим вручную: размонтируем деревья, чистим body (appended <h2>), снимаем
// стаб scrollIntoView с прототипа и глобал IntersectionObserver (jsdom их не
// имеет по умолчанию — иначе течь в другие тест-файлы воркера).
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  vi.restoreAllMocks();
});

function fireIO(entries: { isIntersecting: boolean; target: { id: string } }[]) {
  act(() => {
    const io = MockIO.last;
    io?.cb(
      entries as unknown as IntersectionObserverEntry[],
      io as unknown as IntersectionObserver,
    );
  });
}

describe("AstToc", () => {
  it("пустой список заголовков → ничего не рендерит", () => {
    render(<AstToc headings={[]} label="Содержание" />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("рендерит <nav>, помеченный видимым заголовком через aria-labelledby (без дубля aria-label)", () => {
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBeNull();
    const labelledby = nav.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    const title = screen.getByText("Содержание");
    expect(title.id).toBe(labelledby);
  });

  it("рендерит якорные ссылки с href и текстом", () => {
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("#h-a");
    expect(links[1]?.getAttribute("href")).toBe("#h-b");
    expect(links[1]?.textContent).toBe("Детали");
  });

  it("отступ нормализуется на минимальный уровень в наборе (логический paddingInlineStart)", () => {
    // Набор начинается с level 2 → базовый отступ всё равно 0 (нормализация на minLevel, не на 1).
    const deep: HeadingEntry[] = [
      { id: "x", level: 2, text: "A" },
      { id: "y", level: 3, text: "B" },
    ];
    render(<AstToc headings={deep} label="Содержание" />);
    const links = screen.getAllByRole<HTMLAnchorElement>("link");
    expect(links[0]?.style.paddingInlineStart).toBe("0rem");
    expect(links[1]?.style.paddingInlineStart).toBe("0.75rem");
  });

  it("maxLevel ограничивает показанные уровни", () => {
    render(<AstToc headings={HEADINGS} label="Содержание" maxLevel={1} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("#h-a");
  });

  it("scroll-spy: при нескольких видимых активен первый по порядку документа", () => {
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    fireIO([
      { isIntersecting: true, target: { id: "h-a" } },
      { isIntersecting: true, target: { id: "h-b" } },
    ]);
    const active = screen.getByRole("link", { current: "location" });
    expect(active.getAttribute("href")).toBe("#h-a");
  });

  it("scroll-spy: уход первого заголовка переключает активный на следующий видимый", () => {
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    fireIO([
      { isIntersecting: true, target: { id: "h-a" } },
      { isIntersecting: true, target: { id: "h-b" } },
    ]);
    fireIO([{ isIntersecting: false, target: { id: "h-a" } }]);
    const active = screen.getByRole("link", { current: "location" });
    expect(active.getAttribute("href")).toBe("#h-b");
  });

  it("клик: плавный скролл при обычном motion", () => {
    const scrollIntoView = vi.fn();
    const heading = Object.assign(document.createElement("h2"), { id: "h-b", scrollIntoView });
    document.body.appendChild(heading);
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = within(screen.getByRole("navigation")).getByRole("link", { name: "Детали" });
    fireEvent.click(link);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("клик: мгновенный скролл при reduced motion", () => {
    mock.reduced = true;
    const scrollIntoView = vi.fn();
    const heading = Object.assign(document.createElement("h2"), { id: "h-a", scrollIntoView });
    document.body.appendChild(heading);
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = within(screen.getByRole("navigation")).getByRole("link", { name: "Введение" });
    fireEvent.click(link);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("клик переносит фокус на целевой заголовок (a11y)", () => {
    const heading = Object.assign(document.createElement("h2"), { id: "h-b" });
    document.body.appendChild(heading);
    render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = within(screen.getByRole("navigation")).getByRole("link", { name: "Детали" });
    fireEvent.click(link);
    expect(heading).toHaveFocus();
  });
});

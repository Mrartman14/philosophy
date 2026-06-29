import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// ClampableContent тянет useT("common") для дефолтных лейблов — мокаем
// client-фасад на реальный ru-каталог (резолв dotted-ключа без next-intl).
vi.mock("@/i18n/client", async () => {
  const common = (await import("@/i18n/messages/ru/common")).default;
  const useT = () => (key: string) =>
    key.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], common) ?? key;
  return { useT };
});

import { ClampableContent } from "./clampable-content";

// jsdom: scrollHeight=0 и нет ResizeObserver. Мокаем оба: scrollHeight через
// геттер на прототипе (значение варьируем переменной), RO — no-op класс
// (измерение делает прямой вызов в useLayoutEffect, RO нужен лишь для подписки).
let scrollH = 0;

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return scrollH;
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
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
  delete HTMLElement.prototype.scrollHeight;
});

describe("ClampableContent", () => {
  it("контент в пределах порога → без тоггла", () => {
    scrollH = 100; // < 16rem*16px = 256px
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>short</p>
      </ClampableContent>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("контент сверх порога → тоггл, по умолчанию свёрнут (aria-expanded=false)", () => {
    scrollH = 400; // > 256px
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>long</p>
      </ClampableContent>,
    );
    const btn = screen.getByRole("button", { name: "ещё" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("клик по тогглу разворачивает (aria-expanded=true, лейбл collapse)", () => {
    scrollH = 400;
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>long</p>
      </ClampableContent>,
    );
    fireEvent.click(screen.getByRole("button", { name: "ещё" }));
    const btn = screen.getByRole("button", { name: "свернуть" });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("без лейблов берёт дефолты из common (Показать полностью)", () => {
    scrollH = 400; // > 256px
    render(
      <ClampableContent maxHeight={16}>
        <p>long</p>
      </ClampableContent>,
    );
    expect(screen.getByRole("button", { name: "Показать полностью" }).getAttribute("aria-expanded")).toBe("false");
  });
});

import { useDirection } from "@base-ui/react/direction-provider";
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { DirectionProvider } from "@/components/ui";
import { dirForLocale } from "@/i18n/locales";

afterEach(cleanup);

// Что покрывает ЭТОТ тест: что НАШ ui-kit `DirectionProvider` реально пробрасывает
// направление до Base UI consumer'а (useDirection видит "rtl"). Удаление/инверсия
// проброса direction провалит assert.
//
// Чего тут НЕТ: рендера самого layout.tsx (async RSC, не рендерится в jsdom) и
// проверки строки `<html dir>`. Сама пара `dirForLocale(locale)` → `<html dir>`
// покрыта unit-тестом dirForLocale (src/i18n/direction.test.ts) + ручной QA.

function DirSpy() {
  const dir = useDirection();
  return <span data-testid="dir">{dir}</span>;
}

describe("ui-kit DirectionProvider (проброс направления)", () => {
  it("пробрасывает rtl (от dirForLocale('ar')) до Base UI consumer'а", () => {
    const dir = dirForLocale("ar");
    expect(dir).toBe("rtl");
    render(
      <DirectionProvider direction={dir}>
        <DirSpy />
      </DirectionProvider>,
    );
    // Реальное поведение: consumer ВНУТРИ нашей обёртки видит именно "rtl".
    expect(screen.getByTestId("dir").textContent).toBe("rtl");
  });

  it("пробрасывает ltr (от dirForLocale('ru')) до Base UI consumer'а", () => {
    const dir = dirForLocale("ru");
    expect(dir).toBe("ltr");
    render(
      <DirectionProvider direction={dir}>
        <DirSpy />
      </DirectionProvider>,
    );
    expect(screen.getByTestId("dir").textContent).toBe("ltr");
  });
});

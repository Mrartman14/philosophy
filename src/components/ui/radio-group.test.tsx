import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormField } from "./form-field";
import { RadioGroup } from "./radio-group";

afterEach(cleanup);

const OPTIONS = [
  { value: "system", label: "Система" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

describe("RadioGroup", () => {
  it("рендерит radiogroup с aria-label и по radio на опцию", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Тема" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("помечает текущее значение как checked", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Светлая" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Тёмная" })).not.toBeChecked();
  });

  it("клик по сегменту зовёт onValueChange с его value", () => {
    const onValueChange = vi.fn();
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Тёмная" }));
    // Base UI зовёт onValueChange(value, eventDetails); потребительский тип
    // (value: string) => void игнорирует 2-й аргумент — проверяем именно value.
    expect(onValueChange).toHaveBeenCalledWith("dark", expect.anything());
  });

  it("внутри FormField каждый сегмент сохраняет своё имя (WCAG 4.1.2), а не имя группы", () => {
    render(
      <FormField name="theme" label="Тема">
        <RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />
      </FormField>,
    );
    // Имя группы не должно протекать на каждый сегмент через aria-labelledby Field.Label.
    expect(screen.queryAllByRole("radio", { name: "Тема" })).toHaveLength(0);
    // Каждый сегмент доступен по своему тексту-опции, и это разные элементы.
    const system = screen.getByRole("radio", { name: "Система" });
    const light = screen.getByRole("radio", { name: "Светлая" });
    const dark = screen.getByRole("radio", { name: "Тёмная" });
    expect(system).not.toBe(light);
    expect(light).not.toBe(dark);
    expect(light).toBeChecked();
    expect(dark).not.toBeChecked();
  });

  it("disabled рендерит выключенные radio", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      // Base UI помечает выключенный radio data-атрибутом (стиль-хук) и aria-disabled.
      expect(radio).toHaveAttribute("data-disabled");
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("несёт WAI-ARIA roving-tabindex — субстрат стрелочной навигации", () => {
    // NB: сам переход выбора по ArrowRight/ArrowDown не наблюдаем в jsdom —
    // composite-навигация Base UI требует браузерной обработки key-событий и не
    // эмулируется через fireEvent.keyDown (0 вызовов onValueChange). Поэтому
    // проверяем наблюдаемый субстрат паттерна radiogroup: roving tabindex —
    // выбранный сегмент в табуляции (tabindex=0), остальные изъяты (tabindex=-1),
    // и именно по нему стрелки двигают фокус/выбор в реальном браузере.
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Светлая" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Система" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Тёмная" })).toHaveAttribute("tabindex", "-1");
  });

  it("две группы на странице не коллизируют по id меток сегментов (useId-per-instance)", () => {
    render(
      <>
        <RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />
        <RadioGroup aria-label="Контраст" options={OPTIONS} value="dark" onValueChange={vi.fn()} />
      </>,
    );
    // Каждый сегмент ссылается на свой текст-метку через aria-labelledby
    // (= id нашего per-сегментного span). Префикс id берётся из useId на
    // экземпляр, поэтому у двух групп id меток не должны пересекаться.
    const labelledByIds = screen
      .getAllByRole("radio")
      .map((r) => r.getAttribute("aria-labelledby"));
    // 2 группы × 3 опции = 6 сегментов, у каждого свой aria-labelledby, все разные.
    expect(labelledByIds).toHaveLength(6);
    expect(labelledByIds.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(labelledByIds).size).toBe(labelledByIds.length);
  });

  it("выбранный сегмент несёт не-цветовой аффорданс (font-semibold, B1 WCAG 1.4.1)", () => {
    render(<RadioGroup aria-label="Тема" options={OPTIONS} value="light" onValueChange={vi.fn()} />);
    // Класс с data-[checked]:font-semibold присутствует на сегменте; в активном
    // состоянии это даёт нецветовое отличие (вес шрифта) поверх заливки.
    const light = screen.getByRole("radio", { name: "Светлая" });
    expect(light.className).toContain("data-[checked]:font-semibold");
  });
});

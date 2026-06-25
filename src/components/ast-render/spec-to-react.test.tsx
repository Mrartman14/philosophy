import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NODE_MAP, MARK_MAP, type NeutralSpec } from "@/components/ast-content-map";
import { must } from "@/components/ast-content-map/test-support";

import { specToReact } from "./spec-to-react";

describe("specToReact + NODE_MAP/MARK_MAP (срез спайка)", () => {
  it("paragraph → <p data-block-id> с контентом в HOLE", () => {
    const spec = must(NODE_MAP.paragraph)({ type: "paragraph", attrs: { blockId: "b1" } });
    const { container } = render(<>{specToReact(spec, "текст")}</>);
    const p = container.querySelector("p");
    expect(p?.getAttribute("data-block-id")).toBe("b1");
    expect(p?.textContent).toBe("текст");
  });

  it("data-block-id из верхнеуровневого block.id (read-форма AstBlock)", () => {
    // READ передаёт сырой AstBlock: id на верхнем уровне, НЕ в attrs.blockId.
    const spec = must(NODE_MAP.paragraph)({ id: "p9", type: "paragraph", content: [] } as never);
    const { container } = render(<>{specToReact(spec, "x")}</>);
    expect(container.querySelector("p")?.getAttribute("data-block-id")).toBe("p9");
  });

  it("heading level 3 → <h3 data-block-id>", () => {
    const spec = must(NODE_MAP.heading)({ type: "heading", attrs: { level: 3, blockId: "h1" } });
    const { container } = render(<>{specToReact(spec, "Заголовок")}</>);
    expect(container.querySelector("h3")?.getAttribute("data-block-id")).toBe("h1");
  });

  it("heading без level → дефолт <h2>", () => {
    const spec = must(NODE_MAP.heading)({ type: "heading", attrs: { blockId: "h2" } });
    const { container } = render(<>{specToReact(spec, "Без уровня")}</>);
    expect(container.querySelector("h2")).not.toBeNull();
  });

  it("glossary_ref mark → <a href=/glossary/{id} class=nav-ref>", () => {
    const m = must(must(MARK_MAP.glossary_ref)({ type: "glossary_ref", attrs: { id: "g42" } }));
    const { container } = render(<>{specToReact([...m, "Бытие"], null)}</>);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/glossary/g42");
    expect(a?.className).toBe("nav-ref nav-ref--glossary_ref");
    expect(a?.textContent).toBe("Бытие");
  });

  it("glossary_ref с пустым id → null (голый текст в read)", () => {
    expect(must(MARK_MAP.glossary_ref)({ type: "glossary_ref", attrs: { id: "" } })).toBeNull();
  });

  it("bold mark → <strong>", () => {
    const m = must(must(MARK_MAP.bold)({ type: "bold" }));
    const { container } = render(<>{specToReact([...m, "жирный"], null)}</>);
    expect(container.querySelector("strong")?.textContent).toBe("жирный");
  });

  // Булевы HTML-атрибуты (checked/disabled/readonly) в нейтральной карте
  // представлены ПРИСУТСТВИЕМ ключа (значение ""). React ждёт boolean-проп, а не
  // строку: строка "" — falsy → атрибут бы потерялся. Нужно для read-чекбокса
  // задачи (disabled), который рендерится из общей карты.
  it("булев атрибут (checked+disabled) → boolean-проп, чекбокс отмечен и заблокирован", () => {
    const spec: NeutralSpec = ["input", { type: "checkbox", checked: "", disabled: "" }];
    const { container } = render(<>{specToReact(spec, null)}</>);
    const input = container.querySelector("input");
    expect(input?.getAttribute("type")).toBe("checkbox");
    expect(input?.checked).toBe(true);
    expect(input?.disabled).toBe(true);
  });

  it("отсутствующий булев атрибут → false (чекбокс снят, но заблокирован)", () => {
    const spec: NeutralSpec = ["input", { type: "checkbox", disabled: "" }];
    const { container } = render(<>{specToReact(spec, null)}</>);
    const input = container.querySelector("input");
    expect(input?.checked).toBe(false);
    expect(input?.disabled).toBe(true);
  });

  it("readonly в карте → React readOnly-проп", () => {
    const spec: NeutralSpec = ["input", { type: "text", readonly: "" }];
    const { container } = render(<>{specToReact(spec, null)}</>);
    expect(container.querySelector("input")?.readOnly).toBe(true);
  });
});

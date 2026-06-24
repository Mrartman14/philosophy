import { describe, it, expect, beforeEach } from "vitest";
import { blockPlainText, offsetWithinBlock, locateOffset } from "./dom-text";

function block(html: string): HTMLElement {
  const el = document.createElement("p");
  el.setAttribute("data-block-id", "b1");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("dom-text", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("plainText сквозь форматирование", () => {
    expect(blockPlainText(block("Hello <strong>bold</strong> world"))).toBe("Hello bold world");
  });
  it("<br> → \\n в plainText и в офсетах", () => {
    const b = block("a<br>b");
    expect(blockPlainText(b)).toBe("a\nb");
    // offset узла "b" = 2 (a=1, \n=1)
    const bText = b.childNodes[2]; // text "b" после <br>
    expect(offsetWithinBlock(b, bText, 0)).toBe(2);
  });
  it("кириллица — UTF-16 (1 unit на символ BMP)", () => {
    const b = block("Кант писал");
    const t = b.firstChild!;
    expect(offsetWithinBlock(b, t, 4)).toBe(4); // «Кант» = 4 code units
    expect(blockPlainText(b).length).toBe(10);
  });
  it("эмодзи — суррогатная пара = 2 UTF-16 units", () => {
    const b = block("a😀b");
    expect(blockPlainText(b).length).toBe(4); // a(1)+😀(2)+b(1)
    expect(locateOffset(b, 3)!.offset).toBe(3); // граница после эмодзи
  });
  it("offsetWithinBlock учитывает текст до контейнера", () => {
    const b = block("Hello <strong>bold</strong> world");
    const strong = b.querySelector("strong")!.firstChild!;
    expect(offsetWithinBlock(b, strong, 0)).toBe(6);
    expect(offsetWithinBlock(b, strong, 2)).toBe(8);
  });
  it("locateOffset — обратное", () => {
    const b = block("Hello <strong>bold</strong> world");
    const loc = locateOffset(b, 8)!;
    expect(loc.node.textContent).toBe("bold");
    expect(loc.offset).toBe(2);
  });
  it("locateOffset за пределами → null", () => {
    expect(locateOffset(block("abc"), 999)).toBeNull();
  });
});

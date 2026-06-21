import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn (наивный join)", () => {
  it("отбрасывает falsy-входы", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("пустой вызов даёт пустую строку", () => {
    expect(cn()).toBe("");
  });

  it("склеивает в порядке аргументов, НЕ разрешая конфликты", () => {
    // Строгий kit исключает пересекающиеся утилиты по построению (leaf className
    // закрыт; переопределение базы — типизированным пропом, не className).
    // Поэтому конфликт-резолюшн (tailwind-merge) не нужен.
    expect(cn("flex flex-col", "gap-4")).toBe("flex flex-col gap-4");
  });
});

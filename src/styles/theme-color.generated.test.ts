import { formatHex } from "culori";
import { describe, it, expect } from "vitest";

import { THEME_COLOR } from "./theme-color.generated";
import { BACKDROP } from "./tokens/primitives";

// culori (v4) не поставляет .d.ts → formatHex резолвится как any; локально типизуем.
const toHex = formatHex as (color: string) => string | undefined;

// Анти-дрейф guard: theme-color.generated.ts ДОЛЖЕН быть точным sRGB-hex от
// surface-токена соответствующей темы. Если кто-то правит BACKDROP, но забывает
// пере-сгенерировать (`pnpm generate:tokens`) — этот тест краснеет.
describe("theme-color.generated", () => {
  it("light/dark equal the sRGB hex of the theme surface token", () => {
    expect(THEME_COLOR.light).toBe(toHex(BACKDROP.light.bg));
    expect(THEME_COLOR.dark).toBe(toHex(BACKDROP.dark.bg));
  });
});

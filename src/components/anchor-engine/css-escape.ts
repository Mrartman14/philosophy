// src/components/anchor-engine/css-escape.ts
// jsdom не имеет глобального CSS → guard (иначе TypeError на чтении CSS.escape).
export function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
}

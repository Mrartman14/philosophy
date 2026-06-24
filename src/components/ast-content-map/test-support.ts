/** Тест-хелпер: разворачивает T | null | undefined, бросая при пустом — замена non-null `!`. */
export function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Expected value to be defined");
  return value;
}

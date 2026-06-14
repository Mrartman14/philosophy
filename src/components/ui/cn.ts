// src/components/ui/cn.ts

/** Значение класса: строка либо falsy (отбрасывается). */
type ClassValue = string | false | null | undefined;

/** Условное склеивание классов: склеивает строки через пробел, отбрасывая falsy. */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}

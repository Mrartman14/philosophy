// src/components/ui/cn.ts

/** Значение класса: строка либо falsy (отбрасывается). */
type ClassValue = string | false | null | undefined;

/** Условное склеивание классов: склеивает строки через пробел, отбрасывая falsy. */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}

/**
 * Focus-ring для текстовых инпутов (outline плотно к бордеру, offset-0).
 * Используется в: TextInput, Textarea, Select trigger.
 */
export const FOCUS_RING_INPUT =
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-foreground)";

/**
 * Focus-ring для контролов (кнопки, чекбоксы), offset-2.
 * Используется в: Button, IconButton, Checkbox.
 */
export const FOCUS_RING_CONTROL =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-foreground)";

/**
 * Базовый shell поверхности: скругление + бордер + фон.
 * Используется текстовыми инпутами, select (trigger + popup), checkbox и
 * toast-карточкой; каждый потребитель дописывает собственные токены размера/состояния.
 */
export const SHELL_BASE = "rounded border border-(--color-border) bg-(--color-background)";

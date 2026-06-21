// src/components/ui/cn.ts
import { twMerge } from "tailwind-merge";

/** Значение класса: строка либо falsy (отбрасывается). */
type ClassValue = string | false | null | undefined;

/**
 * Склеивание классов с разрешением Tailwind-конфликтов (последний-в-группе
 * побеждает детерминированно, а не по emit-order). Нужно для ОТКРЫТЫХ
 * structural-поверхностей (Stack/Inline/Toolbar/…), где className потребителя
 * легитимно мёржится с базой; leaf-контролы className не принимают, но `cn`
 * у них всё равно безопасен.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}

/**
 * Focus-ring для текстовых инпутов (outline плотно к бордеру, offset-0).
 * Используется в: TextInput, Textarea, Select trigger.
 */
export const FOCUS_RING_INPUT =
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--color-ring)";

/**
 * Focus-ring для контролов (кнопки, чекбоксы), offset-2.
 * Используется в: Button, IconButton, Checkbox.
 */
export const FOCUS_RING_CONTROL =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)";

/**
 * Базовый shell поверхности: скругление + бордер + фон.
 * Используется текстовыми инпутами, select (trigger + popup), checkbox и
 * toast-карточкой; каждый потребитель дописывает собственные токены размера/состояния.
 */
export const SHELL_BASE = "rounded border border-(--color-border) bg-(--color-surface)";

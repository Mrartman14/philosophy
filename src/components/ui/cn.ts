// src/components/ui/cn.ts

/** Значение класса: строка либо falsy (отбрасывается). */
type ClassValue = string | false | null | undefined;

/**
 * Наивное склеивание классов: join через пробел, отбрасывая falsy.
 * Tailwind-конфликты НЕ разрешает (без tailwind-merge) — в строгом kit они
 * исключены по построению: leaf-контролы className не принимают, а structural-
 * примитивы и их потребители не задают пересекающихся утилит. Если базу
 * примитива нужно переопределить — это делается типизированным пропом
 * (напр. `Inline gap`, `Textarea mono`), а не className-override.
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
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

/**
 * Базовый бокс иконочного/тулбар leaf-контрола: центрирующий inline-flex,
 * скругление, transition. Размер (квадрат-токен `--size-control-h-*` либо
 * `min-w` + горизонтальный паддинг) и тон дописывает потребитель. Общий для
 * IconButton и Toolbar.Button — чтобы геометрия leaf-контролов не разъезжалась
 * (Toolbar.Button раньше нёс литерал `h-9`, мимо density-aware токенов).
 */
export const CONTROL_BOX = "inline-flex items-center justify-center rounded transition";

/**
 * Слой портальных оверлеев (tooltip / menu / popover / context-menu / select /
 * combobox; для Dialog — backdrop+popup). Единая точка истины: ставится на
 * Positioner (это и есть позиционируемый fixed-элемент), у Dialog — прямо на
 * backdrop и popup.
 *
 * ПОЧЕМУ именно `--z-toast` (=50), а не семантический `--z-overlay`(30): sticky
 * AppHeader хардкодит литеральный верх `z-50` и схлопывает лестницу `--z-*`
 * (sticky=20…toast=50 фактически не используется), поэтому всё ниже 50 пряталось
 * бы ПОД хедером. Base UI монтирует портал в конец <body> — ПОСЛЕ хедера, и на
 * равном z-index порядок рисовки решает DOM-порядок → оверлей ложится поверх.
 * Тот же механизм уже работает у тостера (toaster.tsx, тоже z-50 над хедером).
 *
 * Корневой foundation-долг (отдельный согласованный PR, не здесь): хедер сидит на
 * заморожённом `src/components/app/*` и должен бы переехать на `--z-sticky`(20),
 * освободив верхние полосы под overlay/modal/toast по семантике.
 */
export const OVERLAY_LAYER = "z-[var(--z-toast)]";

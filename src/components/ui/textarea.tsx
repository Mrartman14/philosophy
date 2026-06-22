// src/components/ui/textarea.tsx
import { Field } from "@base-ui/react/field";
import { forwardRef, type ComponentProps, type TextareaHTMLAttributes } from "react";

import { cn, FOCUS_RING_INPUT, SHELL_BASE } from "./cn";

/**
 * Leaf-контрол: className НЕ принимается (вид textarea фиксирован kit'ом).
 * Рендерит `Field.Control render={<textarea/>}` → внутри `Field.Root` наследует
 * `name`/aria/validity; standalone — обычная `<textarea>`. Растяжение по высоте —
 * `grow`; моноширинный режим для JSON/кода — `mono`.
 */
export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  /** `true` → `min-h-0 flex-1`: тянуть textarea по высоте flex-колонки. */
  grow?: boolean;
  /** `true` → `font-mono text-xs`: моноширинный мелкий режим для JSON/кода. */
  mono?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ grow, mono, rows = 4, ...rest }, ref) {
    return (
      <Field.Control
        ref={ref}
        className={cn(
          SHELL_BASE,
          "block w-full px-(--space-control-pad-x) py-(--space-control-pad-y)",
          mono ? "font-mono text-xs" : "text-sm",
          "placeholder:text-(--color-fg-muted)",
          FOCUS_RING_INPUT,
          "disabled:opacity-50 data-[invalid]:border-(--color-danger)",
          grow && "min-h-0 flex-1",
        )}
        // textarea-атрибуты (rows/rest) кладём на render-ЭЛЕМЕНТ, а НЕ на
        // Field.Control: его props-тип input-формы (`BaseUIComponentProps<'input'>`),
        // и `rows` на нём → TS2322. mergeProps склеит инжекции Control'а (name/id/
        // aria/value/onChange-clearErrors) поверх textarea, event-handler'ы — чейнятся
        // (важно для controlled). Проверено эмпирически (tsc clean, onChange chains).
        render={<textarea {...({ rows, ...rest } as ComponentProps<"textarea">)} />}
      />
    );
  },
);

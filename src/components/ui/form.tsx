"use client";
// src/components/ui/form.tsx
import { Form as BaseForm } from "@base-ui/react/form";
import { forwardRef, type ComponentProps, type ReactNode } from "react";

interface FormProps extends Omit<ComponentProps<typeof BaseForm>, "children" | "errors" | "className"> {
  errors?: Record<string, string>;
  children: ReactNode;
}

/**
 * Тонкая поведенческая обёртка над Base UI Form — поведение only: принимает
 * `errors`-карту от `ActionResult.fieldErrors` (Base UI сам распределяет ошибки
 * по полям с совпадающим `name`), `onSubmit`/`action`/`ref` + нативные form-атрибуты
 * через rest. Форвардит ref на нативный <form> (нужно для авто-сабмита через
 * formRef.current?.requestSubmit() при контролируемых kit-Select).
 *
 * Раскладку Form НЕ навязывает и `className` НЕ принимает: вертикальные формы
 * оборачивают детей в `<Stack>`, горизонтальные/фильтры — в `<Inline>`,
 * нестандартные сетки — в structural-обёртку.
 */
export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { errors, children, ...rest },
  ref,
) {
  return (
    <BaseForm ref={ref} errors={errors} {...rest}>
      {children}
    </BaseForm>
  );
});

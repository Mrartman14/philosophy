"use client";
// src/components/ui/form.tsx
import { Form as BaseForm } from "@base-ui/react/form";
import { forwardRef, type ComponentProps, type ReactNode } from "react";

import { cn } from "./cn";

interface FormProps extends Omit<ComponentProps<typeof BaseForm>, "children" | "errors"> {
  errors?: Record<string, string>;
  className?: string;
  children: ReactNode;
}

/**
 * Тонкая обёртка над Base UI Form. Принимает `errors`-карту от
 * `ActionResult.fieldErrors`, Base UI сам распределяет ошибки по полям с
 * совпадающим `name`. Форвардит ref на нативный <form> (нужно для авто-сабмита
 * через formRef.current?.requestSubmit() при контролируемых kit-Select).
 */
export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { errors, className, children, ...rest },
  ref,
) {
  return (
    <BaseForm
      ref={ref}
      errors={errors}
      className={cn("flex flex-col gap-4", className)}
      {...rest}
    >
      {children}
    </BaseForm>
  );
});

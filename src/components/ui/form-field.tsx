"use client";
// src/components/ui/form-field.tsx
import { Field } from "@base-ui/react/field";
import type { ReactNode } from "react";

import { cn } from "./cn";

export interface FormFieldProps {
  name: string;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Стандартизированная обёртка над Base UI Field. Внутри `children` рендерится
 * нативный контрол (`<input>`, `<textarea>` или Base UI Field.Control обёртка).
 *
 * Field.Error автоматически берёт сообщение из errors-карты `<Form>` по
 * совпадающему `name`.
 */
export function FormField({
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <Field.Root name={name} className={cn("flex flex-col gap-1", className)}>
      <Field.Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-(--color-danger)">*</span>}
      </Field.Label>
      {children}
      {description && (
        <Field.Description className="text-xs text-(--color-description)">
          {description}
        </Field.Description>
      )}
      <Field.Error className="text-xs text-(--color-danger)" />
    </Field.Root>
  );
}

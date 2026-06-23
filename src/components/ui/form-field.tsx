"use client";
// src/components/ui/form-field.tsx
import { Field } from "@base-ui/react/field";
import type { ReactNode } from "react";

import { useT } from "@/i18n/client";

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
 *
 * Локализация native-валидации: при пустом `required`-контроле Base UI берёт
 * `element.validationMessage` — строку, локализованную по языку БРАУЗЕРА, а не
 * UI-локали (на ru-локали в EN-браузере вылезает «Please fill in this field»).
 * Поэтому для `valueMissing` показываем свой перевод `common.field.required`, а
 * штатный `<Field.Error>` (серверные fieldErrors + прочие native-состояния)
 * рендерим только когда причина — НЕ `valueMissing`. `Field.Validity` гарантирует
 * один видимый месседж: ветки взаимоисключающие, без дубля native+перевод.
 */
export function FormField({
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  const t = useT("common");
  return (
    <Field.Root name={name} className={cn("flex flex-col gap-1", className)}>
      <Field.Label className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-(--color-danger)">*</span>}
      </Field.Label>
      {children}
      {description && (
        <Field.Description className="text-xs text-(--color-fg-muted)">
          {description}
        </Field.Description>
      )}
      <Field.Validity>
        {(v) =>
          v.validity.valueMissing ? (
            <Field.Error match="valueMissing" className="text-xs text-(--color-danger)">
              {t("field.required")}
            </Field.Error>
          ) : (
            <Field.Error className="text-xs text-(--color-danger)" />
          )
        }
      </Field.Validity>
    </Field.Root>
  );
}

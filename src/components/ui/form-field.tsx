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
 * Локализация native-валидации: при невалидном контроле Base UI берёт
 * `element.validationMessage` — строку, локализованную по языку БРАУЗЕРА, а не
 * UI-локали (на ru-локали в EN-браузере вылезает «Please fill in this field»).
 * Поэтому `valueMissing` показываем своим переводом `common.field.required`, а
 * остальные native-состояния (`badInput`/`typeMismatch`/`patternMismatch`/
 * `stepMismatch`/`rangeOverflow|Underflow`/`tooLong|tooShort`), которые
 * нативно-типизированные инпуты поднимают по самому ТИПУ (datetime/number/email/
 * date), — единым переводом `common.field.invalid`. Штатный `<Field.Error>`
 * (серверные fieldErrors) рендерим лишь когда причина — не native-состояние.
 * `Field.Validity` гарантирует один видимый месседж: ветки взаимоисключающие,
 * без дубля native+перевод. `customError` намеренно не покрываем — его источник
 * `setCustomValidity` уже задаёт собственный локализованный текст.
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
        {(v) => {
          const nv = v.validity;
          if (nv.valueMissing) {
            return (
              <Field.Error match="valueMissing" className="text-xs text-(--color-danger)">
                {t("field.required")}
              </Field.Error>
            );
          }
          const otherNative =
            nv.badInput || nv.typeMismatch || nv.patternMismatch ||
            nv.stepMismatch || nv.rangeOverflow || nv.rangeUnderflow ||
            nv.tooLong || nv.tooShort;
          if (otherNative) {
            return (
              <Field.Error match={true} className="text-xs text-(--color-danger)">
                {t("field.invalid")}
              </Field.Error>
            );
          }
          return <Field.Error className="text-xs text-(--color-danger)" />;
        }}
      </Field.Validity>
    </Field.Root>
  );
}

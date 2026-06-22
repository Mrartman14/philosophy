// src/components/ui/typed-form.ts
import type { ReactElement } from "react";

import type { ActionResult } from "@/utils/create-action";

import { FormField, type FormFieldProps } from "./form-field";

/** Ключи объекта-типа, НЕ помеченные `?` (required во входе схемы). */
type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- `{} extends Pick<T,K>` — точный тест на `?`-опциональность ключа
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Required-ключи, для которых форсим проп `required`. boolean-ключи исключаем:
 * required boolean ≠ «галка обязана быть нажата» (ложное срабатывание).
 */
type EnforcedKeys<T> = {
  [K in RequiredKeys<T> & string]: T[K] extends boolean ? never : K;
}[RequiredKeys<T> & string];

type FieldName<T> = keyof T & string;

/** Пропсы Field: `name` ⊂ keyof T; `required` обязателен для enforced-ключей. */
type TypedFieldProps<T, K extends FieldName<T>> = Omit<
  FormFieldProps,
  "name" | "required"
> & { name: K } & (K extends EnforcedKeys<T>
    ? { required: true }
    : { required?: boolean });

export type TypedFieldComponent<T> = <K extends FieldName<T>>(
  props: TypedFieldProps<T, K>,
) => ReactElement;

/**
 * Карта ошибок: ключи ⊂ keyof T плюс cross-field `_form`. Assignable к
 * `Record<string, string>` (= тип пропа `<Form errors>`) — проверено tsc под
 * strict+exactOptionalPropertyTypes. Чтение неизвестного ключа (`e.nope`) —
 * ошибка компиляции (нет index-signature) → typo-защита ключей сохраняется.
 * Это типизированный VIEW поверх рантайм-`Record<string,string>` (cast):
 * корректен для top-level ключей; нестандартные пути Zod (`path:["x","0"]`)
 * в тип не попадут — для плоских схем образцов неактуально.
 */
export type FieldErrors<T> = Partial<Record<FieldName<T>, string>> & {
  _form?: string;
};

export interface TypedForm<T> {
  /** Field-обёртка над kit `FormField`: name ⊂ keyof T, required форсится. */
  Field: TypedFieldComponent<T>;
  /** Типизированное имя поля для контролов и hidden-инпутов. */
  f: (name: FieldName<T>) => string;
  /** Типизированная карта ошибок из ActionResult для `<Form errors>`. */
  errors: (state: ActionResult<unknown>) => FieldErrors<T>;
}

/**
 * Type-only слой типобезопасности форм. `T` — это `z.input<schema>` (НЕ `z.infer`):
 * имена полей и их required-ность берутся со ВХОДА схемы. Рантайм — identity + каст.
 *
 * `Field` — перетипизированный existing `FormField` (рантайм-сигнатура не меняется:
 * любой валидный по `TypedFieldProps` вызов валиден и в рантайме). Generic-ность
 * живёт только в `Field`, всегда связанном с конкретным input-типом.
 */
export function createTypedForm<T>(): TypedForm<T> {
  return {
    Field: FormField as unknown as TypedFieldComponent<T>,
    f: (name) => name,
    errors: (state) =>
      !state.success && state.code === "validation"
        ? (state.fieldErrors as FieldErrors<T>)
        : ({} as FieldErrors<T>),
  };
}

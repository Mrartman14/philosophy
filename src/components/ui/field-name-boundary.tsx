"use client";
// src/components/ui/field-name-boundary.tsx
import { Field } from "@base-ui/react/field";
import type { ReactNode } from "react";

export interface FieldNameBoundaryProps {
  className?: string;
  children: ReactNode;
}

/**
 * Безымянная граница имени поля — вложенный Base UI Field.Root БЕЗ `name`.
 *
 * Любой Base UI Field.Control в поддереве перестаёт наследовать `name` внешнего
 * `<FormField name="x">` (Base UI FieldRoot читает name только из своих props и
 * ставит свежий контекст с `name: undefined`) → его скрытый form-input не
 * рендерится и НЕ уходит в FormData.
 *
 * Назначение — КОМПОЗИТНЫЕ контролы, у которых в поддереве есть собственные
 * kit-контролы (напр. AST-редактор с тулбаром: HeadingSelect/Select), чтобы они
 * не «протекали» в форму-хост дублями поля. Реальное значение такой контрол
 * несёт отдельным сырым `<input name>`, который рендерится ВНЕ этой границы
 * (он не Field.Control → иммунен к шадоингу).
 *
 * Field.Root по умолчанию рендерит `<div>` — лишний DOM-уровень не добавляется.
 */
export function FieldNameBoundary({ className, children }: FieldNameBoundaryProps) {
  return <Field.Root className={className}>{children}</Field.Root>;
}

"use client";
// src/components/ui/fieldset.tsx
import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import type { ReactNode } from "react";

import { cn } from "./cn";

export interface FieldsetProps {
  /** Опционально: у группированных полей без подписи legend нет. */
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Тонкая обёртка над Base UI Fieldset. Legend рендерится только когда передан —
 * часть fieldset'ов (например строка конструктора форм) подписи не имеют.
 *
 * ВАЖНО: base-ui Fieldset.Legend по умолчанию рендерит <div> (не <legend>) —
 * см. node_modules/@base-ui/react/fieldset/legend/FieldsetLegend.js. Чтобы
 * сохранить нативную семантику <legend> при миграции нативных fieldset/legend
 * (и чтобы lint-гард на <legend> не превращал семантику в <div>), форсим реальный
 * <legend> через render-проп. Base UI всё равно навешивает свой id + aria-labelledby
 * на Fieldset.Root, ассоциация подписи с группой сохраняется.
 */
export function Fieldset({ legend, className, children }: FieldsetProps) {
  return (
    <BaseFieldset.Root className={cn("flex flex-col gap-1", className)}>
      {legend !== undefined && (
        <BaseFieldset.Legend render={<legend />} className="text-sm text-(--color-fg-muted)">
          {legend}
        </BaseFieldset.Legend>
      )}
      {children}
    </BaseFieldset.Root>
  );
}

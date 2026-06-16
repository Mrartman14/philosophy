"use client";
// src/features/annotations/ui/annotation-edit-button.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SchemaContextProvider } from "@/components/ast-editor";
import { Button, Dialog } from "@/components/ui";

import type { Annotation } from "../types";

import { AnnotationEditForm } from "./annotation-edit-form";

interface Props {
  annotation: Annotation;
}

/**
 * Кнопка «Редактировать» → модальный диалог с AnnotationEditForm. Версия для
 * optimistic-lock берётся из переданной аннотации (зафиксирована на момент
 * рендера секции; расхождение → 412 на сохранении). AstEditor требует
 * SchemaContextProvider — монтируем его внутри диалога (loadSchema кеширует
 * запрос между экземплярами). После успеха форма зовёт onSuccess → закрываем
 * диалог и router.refresh() (секция перечитывается на сервере).
 */
export function AnnotationEditButton({ annotation }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button variant="secondary">Редактировать</Button>}
      title="Редактировать аннотацию"
    >
      <SchemaContextProvider
        fallback={<p className="text-sm">Загрузка редактора…</p>}
      >
        <AnnotationEditForm
          annotation={annotation}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </SchemaContextProvider>
    </Dialog>
  );
}

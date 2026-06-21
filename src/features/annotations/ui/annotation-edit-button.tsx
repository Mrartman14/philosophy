"use client";
// src/features/annotations/ui/annotation-edit-button.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SchemaResponse } from "@/components/ast-editor";
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { Button, Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { Annotation } from "../types";

import { AnnotationEditForm } from "./annotation-edit-form";

interface Props {
  annotation: Annotation;
  /** Серверно-загруженная схема AST: гидрируем провайдер без похода в бек. */
  initial?: SchemaResponse | undefined;
}

/**
 * Кнопка «Редактировать» → модальный диалог с AnnotationEditForm. Версия для
 * optimistic-lock берётся из переданной аннотации (зафиксирована на момент
 * рендера секции; расхождение → 412 на сохранении). AstEditor требует
 * SchemaContextProvider — монтируем его внутри диалога; схему секция грузит
 * серверно и передаёт пропом `initial` (браузер за ней не ходит). После успеха
 * форма зовёт onSuccess → закрываем диалог и router.refresh().
 */
export function AnnotationEditButton({ annotation, initial }: Props) {
  const router = useRouter();
  const t = useT("annotations");
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<Button tone="neutral">{t("editButton")}</Button>}
      title={t("editDialogTitle")}
    >
      <SchemaContextProvider
        initial={initial}
        fallback={<p className="text-sm">{t("editorLoading")}</p>}
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

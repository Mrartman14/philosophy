"use client";
// src/features/annotations/ui/annotation-composer-dialog.tsx
import { Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { Anchor, ParentEntityType } from "../types";

import { AnnotationAnchorContext } from "./annotation-anchor-context";
import { AnnotationCreateForm } from "./annotation-create-form";

interface Props {
  parentId: string;
  /**
   * Тип родительской сущности — маршрутизирует create на нужный per-entity роут
   * (`createAnnotation` switch-ит по нему). По умолчанию `"document"`: на этом
   * этапе ещё жив `document-annotation-layer`, зовущий диалог без типа.
   */
  parentEntityType?: ParentEntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor?: Anchor | undefined;
}

/**
 * Модалка-композер для создания аннотации из выделения (selection-driven).
 * Контролируемый `open`/`onOpenChange`; при `anchor` — показывает цитату-контекст
 * над урезанной AST-формой. `AnnotationCreateForm` закрывает диалог при success
 * через `onSuccess`.
 */
export function AnnotationComposerDialog({
  parentId,
  parentEntityType = "document",
  open,
  onOpenChange,
  anchor,
}: Props) {
  const t = useT("annotations");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("marginComposerTitle")}>
      <div className="flex flex-col gap-4">
        {anchor && <AnnotationAnchorContext anchor={anchor} />}
        <AnnotationCreateForm
          parentEntityType={parentEntityType}
          parentId={parentId}
          {...(anchor !== undefined ? { anchor } : {})}
          onSuccess={() => {
            onOpenChange(false);
          }}
        />
      </div>
    </Dialog>
  );
}

"use client";
// src/features/comments/ui/comment-composer-dialog.tsx
// Модалка создания заякоренного комментария (selection-driven). Над формой —
// инлайн-цитата выделения (anchor.exact); форма закрывает диалог на успех.
import { Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { Anchor, CommentType } from "../types";

import { CommentAnchoredCreateForm } from "./comment-anchored-create-form";

interface Props {
  lectureId: string;
  rootTypes: CommentType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: Anchor | undefined;
}

export function CommentComposerDialog({ lectureId, rootTypes, open, onOpenChange, anchor }: Props) {
  const t = useT("comments");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("marginComposerTitle")}>
      <div className="flex flex-col gap-4">
        {anchor?.exact && (
          <p className="border-s-2 border-(--color-border) ps-2 text-xs italic text-(--color-fg-muted)">
            {anchor.exact}
          </p>
        )}
        {anchor && (
          <CommentAnchoredCreateForm
            lectureId={lectureId}
            rootTypes={rootTypes}
            anchor={anchor}
            onSuccess={() => {
              onOpenChange(false);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}

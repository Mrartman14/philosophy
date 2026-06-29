// src/features/comments/ui/comment-preview-card.tsx
// Превью корневого заякоренного комментария в левом поле (по клику на фрагмент).
// Лёгкое: тип + автор + тело + кнопка «к треду». Полная дискуссия/ответы/реакции —
// в нижнем треде (CommentSection), куда ведёт OpenThreadButton.
import { AstRender } from "@/components/ast-render";
import { UserView } from "@/components/shared/user-view";
import { ClampableContent } from "@/components/ui";
import { getT } from "@/i18n";

import type { Comment } from "../types";

import { CommentTypeBadge } from "./comment-type-badge";
import { OpenThreadButton } from "./open-thread-button";

export async function CommentPreviewCard({ comment, replyCount }: { comment: Comment; replyCount: number }) {
  const t = await getT("comments");
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
        <CommentTypeBadge type={comment.type} label={t(`type.${comment.type}`)} />
        <UserView user={comment.author} />
      </div>
      <ClampableContent>
        <div className="content" data-size="sm">
          <AstRender blocks={comment.blocks ?? []} />
        </div>
      </ClampableContent>
      <OpenThreadButton
        commentId={comment.id}
        label={replyCount > 0 ? `${t("marginOpenThread")} (${replyCount})` : t("marginOpenThread")}
      />
    </div>
  );
}

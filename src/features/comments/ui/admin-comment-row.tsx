// src/features/comments/ui/admin-comment-row.tsx
import { AstRender } from "@/components/ast-render";
import { UserView } from "@/components/shared/user-view";
import { getLocale, getT } from "@/i18n";
import { getServerTz } from "@/utils/timezone-server";

import { formatCommentDate } from "../comment-format";
import type { Comment } from "../types";

import { CommentDeleteButton } from "./comment-delete-button";
import { CommentTypeBadge } from "./comment-type-badge";

export async function AdminCommentRow({ comment }: { comment: Comment }) {
  const [t, locale, tz] = await Promise.all([
    getT("comments"),
    getLocale(),
    getServerTz(),
  ]);
  const deleted = comment.is_deleted;
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-(--color-border) p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
          <CommentTypeBadge type={comment.type} label={t(`type.${comment.type}`)} />
          <UserView user={{ username: comment.author?.username }} />
          <span>{formatCommentDate(comment.created_at, locale, tz)}</span>
          {deleted && <span className="text-(--color-danger)">{t("adminDeleted")}</span>}
        </div>
        {!deleted && (
          <div className="content" data-size="sm">
            <AstRender blocks={(comment.blocks ?? [])} />
          </div>
        )}
      </div>
      {!deleted && <CommentDeleteButton commentId={comment.id} admin />}
    </div>
  );
}

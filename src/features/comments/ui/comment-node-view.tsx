// src/features/comments/ui/comment-node-view.tsx
// Чистый изоморфный read-only вид одного комментария: badge/автор/дата/якорь-сниппет/
// тело(AstRender)/сводка реакций. БЕЗ getMe/canX/actions/getBlock — рендерится и на
// сервере, и на клиенте (офлайн SavedLectureView из снимка). Интерактив и резолв якоря
// онлайн-контейнер (CommentNode) инжектит через слоты.
import type { ReactNode } from "react";

import { AstRender } from "@/components/ast-render";

import { formatCommentDate } from "../comment-format";
import type { Comment } from "../types";

import { CommentReactionSummary } from "./comment-reaction-summary";
import { CommentTypeBadge } from "./comment-type-badge";

interface Props {
  comment: Comment;
  /** Онлайн: резолвленный контекст якоря (CommentAnchorContext). Офлайн (undefined): статичный сниппет. */
  anchorSlot?: ReactNode;
  /** Онлайн: интерактивные реакции (CommentReactions). Офлайн (undefined): read-only сводка. */
  reactionsSlot?: ReactNode;
  /** Онлайн: кнопки edit/delete/reply. Офлайн: отсутствует. */
  actionsSlot?: ReactNode;
}

export function CommentNodeView({
  comment,
  anchorSlot,
  reactionsSlot,
  actionsSlot,
}: Props): ReactNode {
  if (comment.is_deleted) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-3 text-sm text-(--color-description)">
        Комментарий удалён
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-description)">
        <CommentTypeBadge type={comment.type} />
        <span>{comment.author?.username ?? "—"}</span>
        <span>{formatCommentDate(comment.created_at)}</span>
        {comment.is_edited && <span>(изменён)</span>}
      </div>

      {anchorSlot ??
        (comment.anchor?.exact ? (
          <p className="border-l-2 border-(--color-border) pl-2 text-xs italic text-(--color-description)">
            {comment.anchor.exact}
          </p>
        ) : null)}

      <div className="content" data-size="sm">
        <AstRender blocks={comment.blocks ?? []} />
      </div>

      {reactionsSlot ?? <CommentReactionSummary reactions={comment.reactions} />}

      {actionsSlot}
    </div>
  );
}

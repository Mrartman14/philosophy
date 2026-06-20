// src/features/comments/ui/comment-node-view.tsx
// Чистый изоморфный read-only вид одного комментария: badge/автор/дата/якорь-сниппет/
// тело(AstRender)/сводка реакций. БЕЗ getMe/canX/actions/getBlock — рендерится и на
// сервере, и на клиенте (офлайн SavedLectureView из снимка). Интерактив и резолв якоря
// онлайн-контейнер (CommentNode) инжектит через слоты.
//
// ИЗОМОРФНЫЙ КОНТРАКТ: нет React-хуков, нет getT/useT.
// Переводимые строки передаются через опциональные пропы; дефолт — русский
// литерал (совпадает с каталогом comments.deleted / comments.edited).
// Онлайн-контейнер (CommentNode) передаёт значения из getT("comments").
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
  /**
   * Текст плашки удалённого комментария. Дефолт: "Комментарий удалён".
   * Онлайн-контейнер передаёт t("deleted") из каталога comments.
   */
  deletedLabel?: string;
  /**
   * Суффикс «(изменён)» у отредактированного комментария. Дефолт: "(изменён)".
   * Онлайн-контейнер передаёт t("edited") из каталога comments.
   */
  editedLabel?: string;
  /**
   * Переведённая метка типа комментария для badge. Дефолт (undefined): badge сам
   * берёт русский литерал commentTypeLabel(type). Онлайн-контейнер передаёт
   * t("type.<type>") из каталога comments.
   */
  typeLabel?: string;
}

export function CommentNodeView({
  comment,
  anchorSlot,
  reactionsSlot,
  actionsSlot,
  deletedLabel = "Комментарий удалён",
  editedLabel = "(изменён)",
  typeLabel,
}: Props): ReactNode {
  if (comment.is_deleted) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-3 text-sm text-(--color-fg-muted)">
        {deletedLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
        <CommentTypeBadge type={comment.type} label={typeLabel} />
        <span>{comment.author?.username ?? "—"}</span>
        <span>{formatCommentDate(comment.created_at)}</span>
        {comment.is_edited && <span>{editedLabel}</span>}
      </div>

      {anchorSlot ??
        (comment.anchor?.exact ? (
          <p className="border-l-2 border-(--color-border) pl-2 text-xs italic text-(--color-fg-muted)">
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

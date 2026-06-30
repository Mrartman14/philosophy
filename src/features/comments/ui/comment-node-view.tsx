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
// Локаль даты — опциональный проп `locale`; дефолт (undefined) → ru-fallback
// внутри formatCommentDate. Онлайн-контейнеры резолвят её (getLocale/useLocale)
// и прокидывают, чтобы en-юзер видел дату в своём формате.
import type { ReactNode } from "react";

import { AstRender } from "@/components/ast-render";
import { UserView } from "@/components/shared/user-view";
import type { ResolvedLocale } from "@/i18n/locales";

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
  /**
   * Локаль форматирования даты. Дефолт (undefined) → ru-fallback внутри
   * formatCommentDate (офлайн hook-free путь). Онлайн-контейнеры (CommentNode —
   * server, SavedLectureView → CommentTreeView — client) резолвят локаль через
   * getLocale()/useLocale() и прокидывают, чтобы дата была в формате локали.
   */
  locale?: ResolvedLocale | undefined;
  /**
   * Таймзона форматирования даты. Дефолт (undefined) → UTC-fallback внутри
   * formatCommentDate. Онлайн-контейнеры (CommentNode — server, SavedLectureView →
   * CommentTreeView — client) резолвят её через getServerTz()/useTz() и прокидывают,
   * чтобы дата комментария отображалась в зоне предпочтения пользователя.
   */
  tz?: string | undefined;
  /**
   * Онлайн: пометить обёртку тела как annotation-scope
   * (`data-anchor-scope="comment:<id>"`) — корень, по которому client-коннектор
   * `AnnotationScope` находит тело и позиционирует/регистрирует аннотации в rail.
   * Дефолт false — офлайн/изоморфный путь (SavedLectureView) без скоупа.
   *
   * ИЗОМОРФНЫЙ КОНТРАКТ (Guardrail 4): атрибут вставляется ИНЛАЙН-литералом, БЕЗ
   * импорта `anchorScopeAttr` из barrel `@/components/anchor-engine` — barrel тянет
   * "use client"-движок (MarginRail/AnchorScopeProvider) в офлайн-бандл и сломал бы
   * hook-free контракт view. Значение `comment:<id>` идентично `anchorScopeAttr`.
   */
  scopeEnabled?: boolean;
}

export function CommentNodeView({
  comment,
  anchorSlot,
  reactionsSlot,
  actionsSlot,
  deletedLabel = "Комментарий удалён",
  editedLabel = "(изменён)",
  typeLabel,
  locale,
  tz,
  scopeEnabled = false,
}: Props): ReactNode {
  if (comment.is_deleted) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-3 text-sm text-(--color-fg-muted)">
        {deletedLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
        <CommentTypeBadge type={comment.type} label={typeLabel} />
        <UserView user={comment.author} />
        <span>{formatCommentDate(comment.created_at, locale, tz)}</span>
        {comment.is_edited && <span>{editedLabel}</span>}
      </div>

      {anchorSlot ??
        (comment.anchor?.exact ? (
          <p className="border-s-2 border-(--color-border) ps-2 text-xs italic text-(--color-fg-muted)">
            {comment.anchor.exact}
          </p>
        ) : null)}

      <div
        className="content"
        data-size="sm"
        {...(scopeEnabled ? { "data-anchor-scope": `comment:${comment.id}` } : {})}
      >
        <AstRender blocks={comment.blocks ?? []} />
      </div>

      {reactionsSlot ?? <CommentReactionSummary reactions={comment.reactions} />}

      {actionsSlot}
    </div>
  );
}

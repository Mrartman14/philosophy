// src/features/comments/ui/comment-tree-view.tsx
// Чистое изоморфное read-only дерево комментов: рекурсивно рендерит CommentNodeView
// через groupByParent. Для офлайн-рендера снимка (slice L). Без серверных зависимостей.
//
// ИЗОМОРФНЫЙ КОНТРАКТ: нет React-хуков, нет getT/useT.
// emptyLabel — опциональный проп; дефолт — русский литерал (offline-fallback).
// locale — опциональный проп формата даты; дефолт (undefined) → ru-fallback в
// formatCommentDate. Контейнер, рендерящий снимок в контексте с доступной
// локалью (SavedLectureView — client, useLocale), прокидывает её во все узлы.
import type { ResolvedLocale } from "@/i18n/locales";

import { groupByParent } from "../comment-tree-utils";
import type { Comment, RootSubtree } from "../types";

import { CommentNodeView } from "./comment-node-view";

function BranchView({
  node,
  childrenMap,
  locale,
}: {
  node: Comment;
  childrenMap: Map<string | null, Comment[]>;
  locale?: ResolvedLocale | undefined;
}) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <li className="flex flex-col gap-2">
      <CommentNodeView comment={node} locale={locale} />
      {kids.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-(--color-border) pl-3">
          {kids.map((kid) => (
            <BranchView
              key={kid.id}
              node={kid}
              childrenMap={childrenMap}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface Props {
  subtrees: RootSubtree[];
  /**
   * Текст плашки при пустом дереве. Дефолт: "Комментариев пока нет."
   * Онлайн-контейнеры (CommentTree — server) передают t("empty") из каталога.
   */
  emptyLabel?: string;
  /**
   * Локаль форматирования дат во всех узлах. Дефолт (undefined) → ru-fallback.
   * SavedLectureView (client) резолвит её через useLocale() и прокидывает, чтобы
   * en-юзер видел даты комментариев в своём формате даже из офлайн-снимка.
   */
  locale?: ResolvedLocale | undefined;
}

export function CommentTreeView({
  subtrees,
  emptyLabel = "Комментариев пока нет.",
  locale,
}: Props) {
  if (subtrees.length === 0) {
    return (
      <p className="text-sm text-(--color-fg-muted)">{emptyLabel}</p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {subtrees.flatMap((st) => {
        const root = st.root;
        if (!root) return [];
        const childrenMap = groupByParent([...(st.descendants ?? [])]);
        return [
          <BranchView
            key={root.id}
            node={root}
            childrenMap={childrenMap}
            locale={locale}
          />,
        ];
      })}
    </ul>
  );
}

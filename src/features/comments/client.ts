// src/features/comments/client.ts
// Публичный CLIENT-safe entry слайса comments: изоморфный read-only рендер дерева + типы.
// Импортируется "use client"-кодом (офлайн SavedLectureView в app/saved/**).
// ЗАПРЕЩЕНО реэкспортировать ./api / ./actions / ./permissions / ./schemas (server-only) и
// делать cross-feature импорты — форсит Guardrail 4. server-вывод/интерактив контейнер
// инжектит пропами/слотами (CommentNodeView: anchorSlot/reactionsSlot/actionsSlot).
// CommentNodeView/CommentReactionSummary не реэкспортятся, пока нет прямого потребителя
// (CommentTreeView тянет их транзитивно для рендера) — добавить при необходимости.
export type { Comment, RootSubtree } from "./types";
export { CommentTreeView } from "./ui/comment-tree-view";

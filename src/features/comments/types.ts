// src/features/comments/types.ts
import type { components } from "@/api/schema";

/** Узел дерева комментариев (enrich'нутый сервисом бека). */
export type Comment = components["schemas"]["comment.Comment"];

/** Якорь комментария: координаты фрагмента + цель (target_entity_*). */
export type Anchor = components["schemas"]["comment.Anchor"];

/** Корень + плоский список потомков — единица листинга. */
export type RootSubtree = components["schemas"]["comment.RootSubtree"];

/** Тип узла аргументации (claim/grounds/.../summary). */
export type CommentType = components["schemas"]["comment.CommentType"];

/** Ось реакции (agreement/quality/insight). */
export type ReactionAxis = components["schemas"]["comment.ReactionAxis"];

/** Сводка реакций по осям. */
export type ReactionSummary = components["schemas"]["comment.ReactionSummary"];

/** Мои реакции по осям (приходят при auth). */
export type MyReactions = components["schemas"]["comment.MyReactions"];

/** Лёгкая строка результата поиска (snippet). */
export type CommentSummary = components["schemas"]["comment.CommentSummary"];

/** Ответ GET /api/comments/schema — матрица типов и осей. */
export type CommentSchema = components["schemas"]["comment.SchemaResponse"];

/** AST-блок (тело комментария). */
export type AstBlock = components["schemas"]["ast.Block"];

/** Мета ревизии (элемент списка). */
export type CommentRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type CommentRevision = components["schemas"]["revision.Revision"];

/**
 * GET /api/blocks/{block_id} в schema.ts типизирует data как ast.Block
 * (document/comment блок). Используется только для контекста якоря.
 */
export type ResolvedBlock = AstBlock;

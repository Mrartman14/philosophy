// src/features/comments/types.ts
import type { components } from "@/api/schema";

/** Узел дерева комментариев (enrich'нутый сервисом бека). */
export type Comment = components["schemas"]["comment.Comment"];

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
 * GET /api/blocks/{block_id} в schema.ts отдаёт httputil.Response без
 * типизированного data. Реально data — это ast.Block (document/comment блок).
 * Типизируем вручную (см. docs/superpowers/specs/...coverage...md §10 — дрейф
 * schema.ts). Используется только для контекста якоря.
 */
export type ResolvedBlock = AstBlock;

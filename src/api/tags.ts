// src/api/tags.ts
/**
 * Реестр строковых тегов для `unstable_cache` и `revalidateTag`.
 *
 * Каждая фича добавляет сюда константу при создании своего api.ts. Это
 * защищает от typo (typo в строковом литерале молча сделает тег уникальным,
 * и инвалидация перестанет работать).
 *
 * Конвенция: имя совпадает с именем сущности в множественном числе,
 * например LECTURES, COMMENTS, ANNOTATIONS. Item-теги формируются как
 * `${TAG}:${id}` runtime'ом в api.ts фичи.
 */

export const Tags = {
  ANNOTATIONS: "annotations",
  // Quasi-static схема AST-редактора (/api/ast/schema). Аналогично COMMENT_SCHEMA:
  // меняется крайне редко, бек отдаёт с Cache-Control 1h — кешируем cross-request
  // и инвалидируем отдельным тегом, не привязанным к мутациям контента.
  AST_SCHEMA: "ast:schema",
  BANNERS: "banners",
  CANVASES: "canvas",
  COMMENTS: "comments",
  // Отдельный тег для quasi-static схемы комментариев: мутации комментариев
  // сбрасывают COMMENTS, но НЕ должны сбрасывать кешированную схему (её бек
  // отдаёт с Cache-Control 1h).
  COMMENT_SCHEMA: "comments:schema",
  DOCUMENTS: "documents",
  EVENTS: "events",
  FORMS: "forms",
  GLOSSARY: "glossary",
  LECTURES: "lectures",
  MEDIA: "media",
  PREFERENCES: "preferences",
  SHARE_LINKS: "share-links",
  SUBMISSIONS: "submissions",
  TAGS: "tags",
  TOKENS: "tokens",
  TRAILS: "trails",
  USERS: "users",
} as const;

export type EntityTag = (typeof Tags)[keyof typeof Tags];

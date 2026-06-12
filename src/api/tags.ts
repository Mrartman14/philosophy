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
  EVENTS: "events",
  GLOSSARY: "glossary",
  LECTURES: "lectures",
  PREFERENCES: "preferences",
  TAGS: "tags",
} as const;

export type EntityTag = (typeof Tags)[keyof typeof Tags];

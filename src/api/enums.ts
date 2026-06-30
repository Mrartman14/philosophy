// src/api/enums.ts
/**
 * Рантайм-значения сгенерированных enum'ов бекенда.
 *
 * `schema.ts` даёт только ТИПЫ (стираются при компиляции), а Zod-валидации,
 * итерации и UI-списки нужны значения В РАНТАЙМЕ. Этот модуль — рантайм-
 * компаньон к `@/api/types`: единственный источник значений enum'ов для всех
 * слайсов (вместо локальных `z.enum([...])`-дублей).
 *
 * Каждый кортеж строится через {@link enumValues} и проверяется на ПОЛНОТУ:
 * ошибка компиляции, если значение лишнее (не из enum'а) ИЛИ пропущено
 * какое-то значение enum'а. Последнее ловит дрейф «бек добавил вариант» —
 * после regen `schema.ts` сборка покраснеет, пока список не дополнят.
 *
 * Типы соответствующих enum'ов реэкспортированы в `@/api/types`.
 */
import type { components } from "./schema";

type S = components["schemas"];

/**
 * Возвращает кортеж ВСЕХ значений enum'а `E`. Лишнее значение ломает
 * constraint `readonly E[]`; пропущенное — несовпадение с error-кортежем,
 * который подсказывает недостающее значение.
 */
const enumValues =
  <E extends string>() =>
  <const T extends readonly E[]>(
    ...values: [Exclude<E, T[number]>] extends [never]
      ? T
      : readonly ["enum incomplete — missing:", Exclude<E, T[number]>]
  ): T =>
    values as unknown as T;

// --- Common / RBAC ---
export const VISIBILITY = enumValues<S["access.Visibility"]>()("private", "public");
export const RBAC_ROLES = enumValues<S["rbac.Role"]>()("user", "admin");
export const RBAC_STATUSES = enumValues<S["rbac.Status"]>()("active", "suspended", "banned");

// --- Forms ---
export const FORM_FIELD_TYPES = enumValues<S["form.FieldType"]>()(
  "text",
  "long_text",
  "single_choice",
  "multi_choice",
  "number",
  "date",
);
export const FORM_SUBMISSION_MODES = enumValues<S["form.SubmissionMode"]>()("editable", "immutable");
export const FORM_SUBMISSION_VISIBILITY = enumValues<S["form.SubmissionVisibility"]>()("private", "public");

// --- Banners ---
export const BANNER_TARGET_AUDIENCES = enumValues<S["banner.TargetAudience"]>()(
  "all",
  "authenticated",
  "admin",
);
export const BANNER_VARIANTS = enumValues<S["banner.Variant"]>()(
  "info",
  "success",
  "warning",
  "danger",
  "brand",
  "neutral",
);

// --- Comments ---
export const COMMENT_TYPES = enumValues<S["comment.CommentType"]>()(
  "claim",
  "grounds",
  "rebuttal",
  "qualifier",
  "question",
  "answer",
  "offtop",
  "summary",
);
export const REACTION_AXES = enumValues<S["comment.ReactionAxis"]>()("agreement", "quality", "insight");

// --- Preferences ---
export const READING_MODES = enumValues<S["preference.ReadingMode"]>()("full", "focused");

// --- Canvas ---
export const CANVAS_SHAPE_KINDS = enumValues<S["canvas.ShapeKind"]>()("rect", "ellipse", "diamond");
export const CANVAS_EDGE_SIDES = enumValues<S["canvas.EdgeSide"]>()("top", "right", "bottom", "left");
export const CANVAS_EDGE_STYLES = enumValues<S["canvas.EdgeStyle"]>()("solid", "dashed");
export const CANVAS_EDGE_ENDS = enumValues<S["canvas.EdgeEnd"]>()("none", "arrow");
export const CANVAS_REF_ENTITY_TYPES = enumValues<S["canvas.RefEntityType"]>()(
  "document",
  "annotation",
  "comment",
  "media",
  "glossary",
  "banner",
  "event",
  "form",
  "canvas",
);

// --- Audit ---
export const AUDIT_TARGET_TYPES = enumValues<S["audit.TargetType"]>()(
  "annotation",
  "banner",
  "canvas",
  "comment",
  "document",
  "event",
  "form",
  "glossary_term",
  "lecture",
  "map",
  "media",
  "push",
  "tag",
  "trail",
  "user",
);
export const AUDIT_ACTIONS = enumValues<S["audit.Action"]>()(
  "annotation.admin_delete",
  "annotation.create",
  "annotation.delete",
  "annotation.update",
  "attachment.create",
  "attachment.delete",
  "attachment.entry_clear",
  "attachment.entry_set",
  "attachment.reorder",
  "banner.create",
  "banner.delete",
  "banner.update",
  "canvas.create",
  "canvas.delete",
  "canvas.update",
  "canvas.visibility_change",
  "comment.admin_delete",
  "comment.create",
  "comment.delete",
  "comment.update",
  "document.create",
  "document.delete",
  "document.update",
  "document.upload",
  "document.visibility_change",
  "event.create",
  "event.delete",
  "event.update",
  "form.admin_delete",
  "form.create",
  "form.delete",
  "form.publish",
  "form.vote.delete",
  "form.vote.edit",
  "form.vote.retract",
  "form.vote.submit",
  "glossary.create",
  "glossary.delete",
  "glossary.update",
  "lecture.cover.clear",
  "lecture.cover.set",
  "lecture.create",
  "lecture.delete",
  "lecture.update",
  "lecture.visibility_change",
  "map.rebuild",
  "media.create",
  "media.delete",
  "media.upload",
  "media.visibility_change",
  "push.broadcast",
  "share_link.admin_revoke",
  "share_link.create",
  "share_link.revoke",
  "tag.create",
  "tag.delete",
  "tag.set_lecture_tags",
  "tag.update",
  "trail.create",
  "trail.delete",
  "trail.set_items",
  "trail.update",
  "trail.visibility_change",
  "user.role_change",
  "user.status_change",
);

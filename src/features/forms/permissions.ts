// src/features/forms/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed } from "@/utils/permissions";
import type { Form, Submission } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go
 * (CapFormCreate, CapFormDeleteAny); typo ловит tsc через union `Capability`.
 * Чистые cap-чеки делегированы `can()`: гость → false, не-active → false,
 * иначе членство в capabilities (status-гейт внутри can()). Owner-aware
 * хелперы ниже комбинируют can()-семантику с owner_id вручную.
 */

function isActive(me: MaybeMe): me is NonNullable<MaybeMe> {
  return isMutationAllowed(me);
}

/** Создание формы — capability form.create. */
export function canCreateForm(me: MaybeMe): boolean {
  return can(me, "form.create");
}

/**
 * Редактирование структуры/мета формы — OWNER-ONLY без admin-override и
 * ТОЛЬКО до publish. Бек: published_at != nil ⇒ 409 FORM_PUBLISHED.
 */
export function canEditForm(me: MaybeMe, form: Form): boolean {
  if (!isActive(me)) return false;
  if (form.owner_id !== me.id) return false;
  return !form.published_at;
}

/** Публикация (private → public). Owner, ещё приватная, не опубликована. */
export function canPublishForm(me: MaybeMe, form: Form): boolean {
  if (!isActive(me)) return false;
  if (form.owner_id !== me.id) return false;
  return form.visibility === "private" && !form.published_at;
}

/**
 * Удаление формы. Владелец — любая видимость. delete_any — только public
 * (чужой private админ не видит → бек вернёт 404).
 */
export function canDeleteForm(me: MaybeMe, form: Form): boolean {
  if (!isActive(me)) return false;
  if (form.owner_id === me.id) return true;
  if (!can(me, "form.delete_any")) return false;
  return form.visibility === "public";
}

/** Список откликов формы — только владелец (бек: 403 для остальных). */
export function canListFormSubmissions(me: MaybeMe, form: Form): boolean {
  if (!isActive(me)) return false;
  return form.owner_id === me.id;
}

/** Редактирование отклика — автор, editable-форма, не retracted. */
export function canEditSubmission(me: MaybeMe, form: Form, sub: Submission): boolean {
  if (!isActive(me)) return false;
  if (sub.user_id !== me.id) return false;
  if (form.submission_mode !== "editable") return false;
  return !sub.retracted_at;
}

/** Удаление отклика (освобождает слот) — автор, editable-форма. */
export function canDeleteSubmission(me: MaybeMe, form: Form, sub: Submission): boolean {
  if (!isActive(me)) return false;
  if (sub.user_id !== me.id) return false;
  return form.submission_mode === "editable";
}

/** Отзыв отклика (сжигает слот) — автор, immutable-форма, не retracted. */
export function canRetractSubmission(me: MaybeMe, form: Form, sub: Submission): boolean {
  if (!isActive(me)) return false;
  if (sub.user_id !== me.id) return false;
  if (form.submission_mode !== "immutable") return false;
  return !sub.retracted_at;
}

/** Admin-удаление из списка: delete_any + только public. */
export function canAdminDeleteForm(me: MaybeMe, form: Form): boolean {
  if (!can(me, "form.delete_any")) return false;
  return form.visibility === "public";
}

/** Доступ к admin-списку форм. */
export function canListAdminForms(me: MaybeMe): boolean {
  return can(me, "form.delete_any");
}

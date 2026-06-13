// src/features/documents/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import type { Document } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go
 * (CapDocumentCreate, CapDocumentDeleteAny); typo ловит tsc через union
 * `Capability`. Чистые cap-чеки делегированы `can()`: гость → false,
 * не-active → false, иначе членство в capabilities (status-гейт внутри can()).
 * Owner-aware хелперы ниже комбинируют can()-семантику с owner_id вручную.
 */

/** Создание документа (JSON и upload) — capability document.create. */
export function canCreateDocument(me: MaybeMe): boolean {
  return can(me, "document.create");
}

/**
 * Редактирование (title, blocks, visibility) — OWNER-ONLY без admin-override.
 * Бек: doc.OwnerID == actor.UserID (service.go). Status-гейт обязателен.
 */
export function canEditDocument(me: MaybeMe, doc: Document): boolean {
  if (!me || me.status !== "active") return false;
  return doc.owner_id === me.id;
}

/**
 * Удаление со страницы документа. Владелец — любая видимость. Admin с
 * delete_any — только НЕ-private (private чужой → бек вернёт 404).
 */
export function canDeleteDocument(me: MaybeMe, doc: Document): boolean {
  if (!me || me.status !== "active") return false;
  if (doc.owner_id === me.id) return true;
  if (!can(me, "document.delete_any")) return false;
  return doc.visibility !== "private";
}

/**
 * Удаление из admin-списка: только delete_any и только НЕ-private (§6.2 спеки).
 * Admin-список и так отдаёт только public-документы.
 */
export function canAdminDeleteDocument(me: MaybeMe, doc: Document): boolean {
  if (!can(me, "document.delete_any")) return false;
  return doc.visibility !== "private";
}

/** Доступ к admin-списку документов. */
export function canListAdminDocuments(me: MaybeMe): boolean {
  return can(me, "document.delete_any");
}

/**
 * Бек создаёт ревизии только при мутации public-документа. У private-документа
 * список ревизий всегда пуст — секцию ревизий показываем только для public.
 */
export function canSeeRevisions(doc: Document): boolean {
  return doc.visibility === "public";
}

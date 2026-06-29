// src/features/documents/permissions.ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can, isMutationAllowed, ownerOrCap } from "@/utils/permissions";

import type { Document } from "./types";

/**
 * Имена capabilities сверены с philosophy-api internal/rbac/capabilities.go
 * (CapDocumentCreate, CapDocumentDeleteAny); typo ловит tsc через union
 * `Capability`. Чистые cap-чеки делегированы `can()` (status-гейт внутри
 * can()). Owner-aware-комбинации — через `ownerOrCap` / `isMutationAllowed`.
 */

/** Создание документа (JSON и upload) — capability document.create. */
export function canCreateDocument(me: MaybeMe): boolean {
  return can(me, "document.create");
}

/**
 * Редактирование (title, blocks, visibility) — OWNER-ONLY без admin-override.
 * Бек: doc.OwnerID == actor.UserID (service.go).
 */
export function canEditDocument(me: MaybeMe, doc: Document): boolean {
  return isMutationAllowed(me) && doc.owner?.id === me.id;
}

/**
 * Удаление со страницы документа. Владелец — любая видимость. Admin с
 * delete_any — только public (private чужой → бек вернёт 404).
 */
export function canDeleteDocument(me: MaybeMe, doc: Document): boolean {
  return ownerOrCap(
    me,
    doc.owner?.id,
    "document.delete_any",
    () => doc.visibility === "public",
  );
}

/**
 * Удаление из admin-списка: только delete_any и только public (§6.2 спеки).
 * Admin-список и так отдаёт только public-документы.
 */
export function canAdminDeleteDocument(me: MaybeMe, doc: Document): boolean {
  return can(me, "document.delete_any") && doc.visibility === "public";
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

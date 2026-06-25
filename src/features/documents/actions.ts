// src/features/documents/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

import { API_URL } from "@/api/base-url";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { instrumentedFetch } from "@/services/observability/server-fetch";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessageKeys,
} from "@/utils/api-error";
import { parseEnvelope, unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import {
  ForbiddenError,
  requireActive,
  requireCapability,
} from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { getDocumentById } from "./api";
import { canCreateDocument, canListAdminDocuments } from "./permissions";
import {
  makeDocumentCreateSchema,
  makeDocumentBlocksSchema,
  makeDocumentMetaSchema,
  makeDocumentVisibilitySchema,
  makeDocumentIdSchema,
} from "./schemas";
import type { Document, DocumentBlocksSaveResult } from "./types";

/** Доменные коды бека → ключи каталога errors (Case 2 i18n).
 * role-403/SUSPENDED/BANNED и дефолтный REF_NOT_FOUND обрабатывает
 * централизованный rethrowApiError. BLOCKS_HAVE_ANCHORS / BLOCK_REFERENCED /
 * BLOCKS_EMPTY и прочие получают document-специфичные ключи (отличаются от
 * дефолтного comments-текста). */
const ERRORS: ApiErrorMessageKeys = {
  PUBLIC_IMMUTABLE: "DOCUMENT_PUBLIC_IMMUTABLE",
  DOCUMENT_REFERENCED: "DOCUMENT_REFERENCED",
  BLOCK_REFERENCED: "DOCUMENT_BLOCK_REFERENCED",
  BLOCKS_HAVE_ANCHORS: "DOCUMENT_BLOCKS_HAVE_ANCHORS",
  BLOCKS_EMPTY: "DOCUMENT_BLOCKS_EMPTY",
  BLOCKS_INVALID: "DOCUMENT_BLOCKS_INVALID",
  BLOCK_ID_UNKNOWN: "DOCUMENT_BLOCK_ID_UNKNOWN",
  DUPLICATE_BLOCK_ID: "DOCUMENT_DUPLICATE_BLOCK_ID",
  IMAGE_UNKNOWN_KEY: "DOCUMENT_IMAGE_UNKNOWN_KEY",
};

/** POST /api/documents (JSON). Гейт — document.create. */
export const createDocument = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const t = await getT("validation");
  const input = parseFormData(makeDocumentCreateSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/documents", {
    body: {
      title: input.title,
      blocks: input.blocks,
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS);
  return unwrap(data);
}, "createDocument");

/**
 * POST /api/documents/upload (multipart). FormData с File нельзя гнать через
 * parseFormData — отправляем напрямую fetch'ем с Bearer-токеном (паттерн
 * src/components/ast-editor/upload/upload-image.ts). Поля: file (.md/.markdown),
 * visibility (опц.).
 */
export const uploadDocument = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Выберите файл .md для загрузки.");
  }
  const token = (await cookies()).get("token")?.value;
  // Пересобираем FormData: только разрешённые бекендом поля.
  const upstream = new FormData();
  upstream.set("file", file);
  const vis = formData.get("visibility");
  if (vis === "public" || vis === "private") upstream.set("visibility", vis);

  let res: Response;
  try {
    res = await instrumentedFetch(`${API_URL}/api/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: upstream,
    }, { surface: "document.upload" });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Сетевая ошибка при загрузке");
  }
  if (res.status === 401 || res.status === 403) {
    throw new ForbiddenError("role");
  }
  if (res.status !== 201 && res.status !== 200) {
    let body: ApiError = {};
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* non-JSON */
    }
    rethrowApiError(
      body.code ? body : { error: `Ошибка загрузки: ${res.status}` },
      ERRORS,
    );
  }
  const doc = await parseEnvelope<Document>(res);
  revalidateEntity(Tags.DOCUMENTS);
  return doc;
}, "uploadDocument");

/** PATCH /api/documents/{id} (метаданные — title). Owner-only enforce'ит бек. */
export const updateDocumentMeta = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeDocumentMetaSchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/documents/{document_id}", {
    params: { path: { document_id: input.id } },
    body: { title: input.title },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return unwrap(data);
}, "updateDocumentMeta");

/**
 * PUT /api/documents/{id}/blocks. Owner-only enforce'ит бек. Content-edit PUT
 * требует `If-Match: "<version>"` (optimistic lock, см.
 * docs/conventions/optimistic-locking.md). Версия берётся из `document.version`
 * (тело single-GET) через hidden-поле формы. Отсутствие → 428, расхождение → 412.
 */
export const updateDocumentBlocks = createFormAction(
  async (formData, ctx): Promise<DocumentBlocksSaveResult> => {
    const me = await getMe();
    requireActive(me);
    const t = await getT("validation");
    const input = parseFormData(makeDocumentBlocksSchema(t), formData);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/documents/{document_id}/blocks", {
      params: {
        path: { document_id: input.id },
        header: ifMatchHeader(formData, "документа"),
      },
      body: { blocks: input.blocks },
      headers: idempotencyHeaders(ctx.idempotencyKey),
    });
    if (error) {
      // Конфликт версий: тянем свежую серверную пару blocks+version (single-GET)
      // и отдаём её как conflict-данные — форма откроет merge-вью. Версию берём
      // из тела GET (согласованная пара), а не из ETag 412.
      if (error.code === "VERSION_MISMATCH") {
        const fresh = await getDocumentById(input.id);
        if (!fresh) return { kind: "gone" };
        return {
          kind: "conflict",
          theirs: { blocks: fresh.blocks ?? [], version: fresh.version ?? 0 },
        };
      }
      rethrowApiError(error, ERRORS);
    }
    revalidateEntity(Tags.DOCUMENTS, input.id);
    revalidateEntity(Tags.DOCUMENTS);
    return { kind: "saved", document: unwrap(data) };
  },
  "updateDocumentBlocks",
);

/** PATCH /api/documents/{id}/visibility. UI шлёт только private→public. */
export const setDocumentVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const input = parseFormData(makeDocumentVisibilitySchema(t), formData);
  const api = await createApiClient();
  const { data, error } = await api.PATCH("/api/documents/{document_id}/visibility", {
    params: { path: { document_id: input.id } },
    body: { visibility: input.visibility },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return unwrap(data);
}, "setDocumentVisibility");

/** DELETE /api/documents/{id}. Owner или admin (delete_any, не-private) — enforce'ит бек. */
export const deleteDocument = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireActive(me);
  const t = await getT("validation");
  const { id } = makeDocumentIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/documents/{document_id}", {
    params: { path: { document_id: id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
}, "deleteDocument");

/** DELETE /api/admin/documents/{id}. Гейт — document.delete_any (только public). */
export const adminDeleteDocument = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canListAdminDocuments);
  const t = await getT("validation");
  const { id } = makeDocumentIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/documents/{document_id}", {
    params: { path: { document_id: id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
}, "adminDeleteDocument");

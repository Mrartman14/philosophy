// src/features/documents/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import {
  rethrowApiError,
  type ApiError,
  type ApiErrorMessages,
} from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
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

import { canCreateDocument, canListAdminDocuments } from "./permissions";
import {
  DocumentCreateSchema,
  DocumentBlocksSchema,
  DocumentMetaSchema,
  DocumentVisibilitySchema,
  DocumentIdSchema,
} from "./schemas";
import type { Document } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/** Доменные коды бека → русский текст. role-403/SUSPENDED/BANNED и дефолтный
 * REF_NOT_FOUND обрабатывает централизованный rethrowApiError. BLOCKS_HAVE_ANCHORS
 * у документов отличается от дефолта, поэтому переопределён локально. */
const ERRORS: ApiErrorMessages = {
  PUBLIC_IMMUTABLE: "Публичный документ нельзя сделать приватным.",
  DOCUMENT_REFERENCED:
    "На документ ссылаются другие материалы. Удалите ссылки, затем повторите.",
  BLOCK_REFERENCED:
    "На блок документа ссылаются извне. Удалите ссылки или оставьте блок.",
  BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Сначала удалите комментарии.",
  BLOCKS_EMPTY: "Документ должен содержать хотя бы один блок.",
  BLOCKS_INVALID: "Тело документа не прошло валидацию AST.",
  BLOCK_ID_UNKNOWN: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  DUPLICATE_BLOCK_ID: "Ошибка идентификаторов блоков. Перезагрузите редактор.",
  IMAGE_UNKNOWN_KEY: "В документе есть изображение с неизвестным ключом.",
};

/** POST /api/documents (JSON). Гейт — document.create. */
export const createDocument = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const input = parseFormData(DocumentCreateSchema, formData);
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
    res = await fetch(`${API_URL}/api/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: upstream,
    });
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
  const json = (await res.json()) as { data?: Document };
  revalidateEntity(Tags.DOCUMENTS);
  return json.data ?? null;
}, "uploadDocument");

/** PATCH /api/documents/{id} (метаданные — title). Owner-only enforce'ит бек. */
export const updateDocumentMeta = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(DocumentMetaSchema, formData);
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
export const updateDocumentBlocks = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(DocumentBlocksSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/documents/{document_id}/blocks", {
    params: {
      path: { document_id: input.id },
      header: ifMatchHeader(formData, "документа"),
    },
    body: { blocks: input.blocks },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return unwrap(data);
}, "updateDocumentBlocks");

/** PATCH /api/documents/{id}/visibility. UI шлёт только private→public. */
export const setDocumentVisibility = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(DocumentVisibilitySchema, formData);
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
  const { id } = DocumentIdSchema.parse({ id: rawId });
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
  const { id } = DocumentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/documents/{document_id}", {
    params: { path: { document_id: id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
}, "adminDeleteDocument");

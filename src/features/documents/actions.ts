// src/features/documents/actions.ts
"use server";
import "server-only";
import { cookies } from "next/headers";

import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
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

/** Маппинг UPPER_SNAKE_CASE кодов бека в понятный русский текст. */
function rethrowApiError(err: ApiError | undefined): never {
  switch (err?.code) {
    case "PUBLIC_IMMUTABLE":
      throw new Error("Публичный документ нельзя сделать приватным.");
    case "DOCUMENT_REFERENCED":
      throw new Error(
        "На документ ссылаются другие материалы. Удалите ссылки, затем повторите.",
      );
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок документа ссылаются извне. Удалите ссылки или оставьте блок.",
      );
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Сначала удалите комментарии.",
      );
    case "BLOCKS_EMPTY":
      throw new Error("Документ должен содержать хотя бы один блок.");
    case "BLOCKS_INVALID":
    case "DUPLICATE_BLOCK_ID":
    case "BLOCK_ID_UNKNOWN":
      throw new Error("Тело документа не прошло валидацию AST.");
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
    case "IMAGE_UNKNOWN_KEY":
      throw new Error("В документе есть изображение с неизвестным ключом.");
  }
  handleCommonApiError(err);
}

/** POST /api/documents (JSON). Гейт — document.create. */
export const createDocument = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateDocument);
  const input = parseFormData(DocumentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/documents", {
    body: {
      title: input.title,
      blocks: input.blocks as never,
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return (data.data ?? null) as Document | null;
});

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
    rethrowApiError(body.code ? body : { error: `Ошибка загрузки: ${res.status}` });
  }
  const json = (await res.json()) as { data?: Document };
  revalidateEntity(Tags.DOCUMENTS);
  return json.data ?? null;
});

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
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data.data ?? null) as Document | null;
});

/** PUT /api/documents/{id}/blocks. Owner-only enforce'ит бек. */
export const updateDocumentBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  requireActive(me);
  const input = parseFormData(DocumentBlocksSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/documents/{document_id}/blocks", {
    params: { path: { document_id: input.id } },
    body: { blocks: input.blocks as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data.data ?? null) as Document | null;
});

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
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS, input.id);
  revalidateEntity(Tags.DOCUMENTS);
  return (data.data ?? null) as Document | null;
});

/** DELETE /api/documents/{id}. Owner или admin (delete_any, не-private) — enforce'ит бек. */
export const deleteDocument = createAction(async (rawId: string) => {
  const me = await getMe();
  requireActive(me);
  const { id } = DocumentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/documents/{document_id}", {
    params: { path: { document_id: id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
});

/** DELETE /api/admin/documents/{id}. Гейт — document.delete_any (только public). */
export const adminDeleteDocument = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canListAdminDocuments);
  const { id } = DocumentIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/documents/{document_id}", {
    params: { path: { document_id: id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.DOCUMENTS);
  return undefined;
});

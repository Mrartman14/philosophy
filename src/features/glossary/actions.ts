// src/features/glossary/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
import { unwrap } from "@/utils/api-unwrap";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
import { ifMatchHeader } from "@/utils/optimistic-lock";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import {
  canCreateTerm,
  canUpdateTerm,
  canDeleteTerm,
} from "./permissions";
import {
  TermCreateSchema,
  TermBlocksUpdateSchema,
  TermIdSchema,
} from "./schemas";


const ERRORS: ApiErrorMessages = {
  BLOCKS_EMPTY: "Тело термина не может быть пустым.",
  BLOCK_REFERENCED:
    "На блок ссылаются другие материалы. Удалите ссылки или оставьте блок.",
};

export const createTerm = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateTerm);
  const input = parseFormData(TermCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/glossary", {
    body: {
      title: input.title,
      blocks: [
        {
          id: "",
          type: "paragraph",
          content: [],
        },
      ],
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY);
  return unwrap(data);
});

/**
 * PUT /api/admin/glossary/{id}/blocks. Content-edit PUT требует
 * `If-Match: "<version>"` (optimistic lock, см.
 * docs/conventions/optimistic-locking.md). Версия берётся из `term.version`
 * (тело single-GET) через hidden-поле формы. Отсутствие → 428, расхождение → 412.
 */
export const updateTermBlocks = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateTerm);
  const input = parseFormData(TermBlocksUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/glossary/{id}/blocks", {
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "термина"),
    },
    body: { blocks: input.blocks },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY, input.id);
  revalidateEntity(Tags.GLOSSARY);
  return unwrap(data);
});

export const deleteTerm = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canDeleteTerm);
  const { id } = TermIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY);
  return undefined;
});

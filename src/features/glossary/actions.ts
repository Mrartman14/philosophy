// src/features/glossary/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { getT } from "@/i18n";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
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
  makeTermCreateSchema,
  makeTermBlocksUpdateSchema,
  makeTermIdSchema,
} from "./schemas";


const ERRORS: ApiErrorMessageKeys = {
  BLOCKS_EMPTY: "GLOSSARY_BLOCKS_EMPTY",
  BLOCK_REFERENCED: "GLOSSARY_BLOCK_REFERENCED",
};

export const createTerm = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateTerm);
  const t = await getT("validation");
  const input = parseFormData(makeTermCreateSchema(t), formData);
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
}, "createTerm");

/**
 * PUT /api/admin/glossary/{id}/blocks. Content-edit PUT требует
 * `If-Match: "<version>"` (optimistic lock, см.
 * docs/conventions/optimistic-locking.md). Версия берётся из `term.version`
 * (тело single-GET) через hidden-поле формы. Отсутствие → 428, расхождение → 412.
 */
export const updateTermBlocks = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateTerm);
  const t = await getT("validation");
  const input = parseFormData(makeTermBlocksUpdateSchema(t), formData);
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
}, "updateTermBlocks");

export const deleteTerm = createAction(async (rawId: string, ctx) => {
  const me = await getMe();
  requireCapability(me, canDeleteTerm);
  const t = await getT("validation");
  const { id } = makeTermIdSchema(t).parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY);
  return undefined;
}, "deleteTerm");

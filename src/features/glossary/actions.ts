// src/features/glossary/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { idempotencyHeaders } from "@/utils/idempotency";
import { getMe } from "@/utils/me";
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
import type { Term } from "./types";

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
  return (data.data ?? null) as Term | null;
});

export const updateTermBlocks = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canUpdateTerm);
  const input = parseFormData(TermBlocksUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/glossary/{id}/blocks", {
    params: { path: { id: input.id } },
    body: { blocks: input.blocks as never },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY, input.id);
  revalidateEntity(Tags.GLOSSARY);
  return (data.data ?? null) as Term | null;
});

export const deleteTerm = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDeleteTerm);
  const { id } = TermIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.GLOSSARY);
  return undefined;
});

// src/features/glossary/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import {
  createAction,
  createFormAction,
  parseFormData,
} from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { handleCommonApiError, type ApiError } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { Tags } from "@/api/tags";
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

function rethrowApiError(err: ApiError | undefined): never {
  // Бек пишет code в UPPER_SNAKE_CASE (internal/apperror, middleware/auth.go) —
  // сравнение с lowercase "forbidden" не срабатывало (паттерн — events/actions.ts).
  switch (err?.code) {
    case "BLOCKS_EMPTY":
      throw new Error("Тело термина не может быть пустым.");
    case "BLOCKS_HAVE_ANCHORS":
      throw new Error(
        "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок."
      );
    case "BLOCK_REFERENCED":
      throw new Error(
        "На блок ссылаются другие материалы. Удалите ссылки или оставьте блок."
      );
    case "REF_NOT_FOUND":
      throw new Error("Одна из ссылок указывает на несуществующий объект.");
  }
  handleCommonApiError(err);
}

export const createTerm = createFormAction(async (formData) => {
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
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY);
  return (data?.data ?? null) as Term | null;
});

export const updateTermBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canUpdateTerm);
  const input = parseFormData(TermBlocksUpdateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/glossary/{id}/blocks", {
    params: { path: { id: input.id } },
    body: { blocks: input.blocks as never },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY, input.id);
  revalidateEntity(Tags.GLOSSARY);
  return (data?.data ?? null) as Term | null;
});

export const deleteTerm = createAction(async (rawId: string) => {
  const me = await getMe();
  requireCapability(me, canDeleteTerm);
  const { id } = TermIdSchema.parse({ id: rawId });
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity(Tags.GLOSSARY);
  return undefined;
});

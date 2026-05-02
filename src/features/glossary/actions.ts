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
import { ForbiddenError, requireCapability } from "@/utils/permissions";
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

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  if (err?.code === "forbidden") {
    throw new ForbiddenError("role", err.error);
  }
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
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createTerm = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(TermCreateSchema, formData);
  requireCapability(me, canCreateTerm);
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

// updateTermBlocks — Task 18
// deleteTerm — Task 19

// Заглушки, чтобы TS не жаловался на unused imports пока другие actions не дописаны
// (удаляются в Task 18 / Task 19):
void canUpdateTerm;
void canDeleteTerm;
void TermBlocksUpdateSchema;
void TermIdSchema;
void createAction;

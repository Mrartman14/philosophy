import "server-only";
import { unstable_cache } from "next/cache";

import { createPublicApiClient } from "@/api/client";
import { Tags } from "@/api/tags";

import type { SchemaResponse } from "./types";

/**
 * Серверный загрузчик схемы AST-редактора. Публичный эндпоинт, бек ставит
 * Cache-Control 1h. Кешируем cross-request тегом AST_SCHEMA — инвалидируется
 * крайне редко (точно так же, как getCommentSchema в comments/api.ts).
 *
 * Источник схемы держим на сервере: браузер за ней больше не ходит — серверные
 * компоненты передают результат пропом `initial` в SchemaContextProvider, а
 * чисто-клиентские маунты дёргают getAstSchemaAction (тонкая обёртка вокруг
 * этого фетчера). Это убирает прямой поход браузер→бек и заодно чинит баг с
 * `process.env.API_URL` (не NEXT_PUBLIC_*, в клиентском бандле схлопывался в
 * localhost).
 */
export const getAstSchema = unstable_cache(
  async (): Promise<SchemaResponse> => {
    const api = createPublicApiClient();
    const { data, error } = await api.GET("/api/ast/schema");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- openapi types this route error as never, but openapi-fetch sets it at runtime on network/non-2xx failures
    if (error) throw new Error("Не удалось загрузить схему AST-редактора");
    return data;
  },
  ["ast-schema"],
  { tags: [Tags.AST_SCHEMA] },
);

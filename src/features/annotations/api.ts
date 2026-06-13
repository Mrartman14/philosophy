// src/features/_template/api.ts
import "server-only";
import { cache } from "react";
// import { unstable_cache } from "next/cache";
// import { createApiClient } from "@/api/client";

/**
 * Серверные fetchers сущности. Дедуплицируются через React.cache внутри одного
 * запроса. Для cross-request кеширования — обернуть в unstable_cache с тегом
 * `entity` (для list) или `entity:<id>` (для item).
 */

// export const getEntities = cache(async () => {
//   const api = await createApiClient();
//   const { data, error } = await api.GET("/...");
//   if (error) throw new Error(error.message);
//   return data;
// });

export const _placeholder = cache(async () => null);

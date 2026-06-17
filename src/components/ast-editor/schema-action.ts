"use server";

import type { SchemaResponse } from "./types";

/**
 * Server-action-обёртка над getAstSchema. Единственный способ для чисто-
 * клиентских маунтов (диалоги, где провайдер монтируется внутри `"use client"`
 * компонента и `initial` пропом не дотянуться) забрать схему, не обращаясь в бек
 * из браузера. Дефолтный фетчер SchemaContextProvider.
 *
 * `schema-server` тянем динамически: его top-level импортит `server-only` и
 * `next/cache`, а этот модуль попадает в граф клиентского компонента —
 * статический импорт затащил бы серверный код в момент загрузки провайдера.
 */
export async function getAstSchemaAction(): Promise<SchemaResponse> {
  const { getAstSchema } = await import("./schema-server");
  return getAstSchema();
}

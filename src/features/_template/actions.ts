// src/features/_template/actions.ts
"use server";
import "server-only";
// import { createFormAction, parseFormData } from "@/utils/create-action";
// import { requireCapability } from "@/utils/permissions";
// import { revalidateEntity } from "@/utils/revalidate";
// import { getMe } from "@/utils/me";
// import { createApiClient } from "@/api/client";
// import { rethrowApiError } from "@/utils/api-error";
// import { idempotencyHeaders } from "@/utils/idempotency";
// import { canCreateEntity } from "./permissions";
// import { EntityCreateSchema } from "./schemas";

/**
 * Server actions сущности. Каждое действие:
 * 1. await getMe()
 * 2. requireCapability(me, canX) — для capability-чека
 * 3. parseFormData(Schema, formData) — для Zod-валидации (если форма)
 * 4. createApiClient() + вызов бекенда (для мутаций — headers: idempotencyHeaders(ctx.idempotencyKey))
 * 5. revalidateEntity("entity", id?) после успешной мутации
 */

// export const createEntity = createFormAction(async (formData, ctx) => {
//   const me = await getMe();
//   const input = parseFormData(EntityCreateSchema, formData);
//   requireCapability(me, canCreateEntity);
//   const api = await createApiClient();
//   const { data, error } = await api.POST("/entities", {
//     body: input,
//     // идемпотентность: ключ приходит из <IdempotencyField/> в форме.
//     headers: idempotencyHeaders(ctx.idempotencyKey),
//   });
//   if (error) rethrowApiError(error);
//   revalidateEntity("entities");
//   return data;
// });

// eslint-disable-next-line @typescript-eslint/require-await -- placeholder; will be replaced by a real async server action before use
export const _placeholder = async () => null;

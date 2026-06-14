// src/features/users/actions.ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { createAction } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";

import { rethrowUserApiError } from "./errors";
import { canModerateUsers } from "./permissions";
import { UserRoleUpdateSchema, UserStatusUpdateSchema } from "./schemas";
import type { AdminUser } from "./types";

/**
 * Смена роли пользователя. PUT /api/admin/users/{id}/role (user.moderate).
 * Гарды «не себя» / «не последнего активного админа» enforce'ит бекенд (409) —
 * переводятся в русские тексты в rethrowUserApiError.
 */
export const setUserRole = createAction(
  async (input: { id: string; role: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = UserRoleUpdateSchema.parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/role", {
      params: { path: { id: parsed.id } },
      body: { role: parsed.role },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data.data ?? null;
  },
);

/**
 * Смена статуса пользователя. PUT /api/admin/users/{id}/status (user.moderate).
 */
export const setUserStatus = createAction(
  async (input: { id: string; status: string }): Promise<AdminUser | null> => {
    const me = await getMe();
    requireCapability(me, canModerateUsers);
    const parsed = UserStatusUpdateSchema.parse(input);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/admin/users/{id}/status", {
      params: { path: { id: parsed.id } },
      body: { status: parsed.status },
    });
    if (error) rethrowUserApiError(error);
    revalidateEntity(Tags.USERS);
    return data.data ?? null;
  },
);

// src/features/users/schemas.ts
import "server-only";
import { z } from "zod";

import { RBAC_ROLES, RBAC_STATUSES } from "@/api/enums";
import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

/**
 * Enum-значения зеркалят бекенд (philosophy-api/internal/user/request.go:
 * oneof=user admin / oneof=active suspended banned) и schema.ts
 * (user.UpdateRoleRequest / user.UpdateStatusRequest).
 */

export function makeUserRoleUpdateSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("users.invalidId")),
    role: z.enum(RBAC_ROLES),
  });
}

export function makeUserStatusUpdateSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("users.invalidId")),
    status: z.enum(RBAC_STATUSES),
  });
}

export type UserRoleUpdateInput = z.infer<ReturnType<typeof makeUserRoleUpdateSchema>>;
export type UserStatusUpdateInput = z.infer<ReturnType<typeof makeUserStatusUpdateSchema>>;

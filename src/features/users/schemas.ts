// src/features/users/schemas.ts
import "server-only";
import { z } from "zod";

import { RBAC_ROLES, RBAC_STATUSES } from "@/api/enums";

/**
 * Enum-значения зеркалят бекенд (philosophy-api/internal/user/request.go:
 * oneof=user admin / oneof=active suspended banned) и schema.ts
 * (user.UpdateRoleRequest / user.UpdateStatusRequest).
 */

export const UserRoleUpdateSchema = z.object({
  id: z.uuid("Некорректный id пользователя"),
  role: z.enum(RBAC_ROLES),
});

export const UserStatusUpdateSchema = z.object({
  id: z.uuid("Некорректный id пользователя"),
  status: z.enum(RBAC_STATUSES),
});

export type UserRoleUpdateInput = z.infer<typeof UserRoleUpdateSchema>;
export type UserStatusUpdateInput = z.infer<typeof UserStatusUpdateSchema>;

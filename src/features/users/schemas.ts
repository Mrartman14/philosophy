// src/features/users/schemas.ts
import "server-only";
import { z } from "zod";

/**
 * Enum-значения зеркалят бекенд (philosophy-api/internal/user/request.go:
 * oneof=user admin / oneof=active suspended banned) и schema.ts
 * (user.UpdateRoleRequest / user.UpdateStatusRequest).
 */

export const UserRoleUpdateSchema = z.object({
  id: z.uuid("Некорректный id пользователя"),
  role: z.enum(["user", "admin"]),
});

export const UserStatusUpdateSchema = z.object({
  id: z.uuid("Некорректный id пользователя"),
  status: z.enum(["active", "suspended", "banned"]),
});

export type UserRoleUpdateInput = z.infer<typeof UserRoleUpdateSchema>;
export type UserStatusUpdateInput = z.infer<typeof UserStatusUpdateSchema>;

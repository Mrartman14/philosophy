// src/features/users/types.ts
import type { components } from "@/api/schema";

/** Пользователь в админ-списке: id, username, role, status, created_at, updated_at. */
export type AdminUser = components["schemas"]["user.User"];

/** "user" | "admin" */
export type UserRole = components["schemas"]["rbac.Role"];

/** "active" | "suspended" | "banned" */
export type UserStatus = components["schemas"]["rbac.Status"];

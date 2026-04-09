import { createApiClient } from "@/api/client";
import type { User } from "@/api/types";

export interface AdminUserListResult {
  data: User[];
  offset: number;
  limit: number;
  total: number;
}

export async function getUsers(
  offset = 0,
  limit = 20
): Promise<AdminUserListResult> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/api/admin/users", {
    params: { query: { offset, limit } },
  });
  if (error || !data) throw new Error("Ошибка загрузки пользователей");
  return {
    data: data.data ?? [],
    offset: data.pagination?.offset ?? offset,
    limit: data.pagination?.limit ?? limit,
    total: data.pagination?.total ?? 0,
  };
}

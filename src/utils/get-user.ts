import { cookies } from "next/headers";

export interface AuthUser {
  id: string;
  role: "user" | "moderator" | "admin";
  status: "active" | "suspended" | "banned";
}

interface JwtPayload {
  user_id: string;
  role: string;
  status: string;
  exp: number;
}

/**
 * Читает JWT из cookie и возвращает данные пользователя или null.
 *
 * Декодирует JWT без проверки подписи — это допустимо для server components,
 * т.к. все мутации идут через бэкенд, который верифицирует подпись.
 */
export async function getUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64").toString()
    ) as JwtPayload;

    if (payload.exp * 1000 < Date.now()) return null;

    return {
      id: payload.user_id,
      role: payload.role as AuthUser["role"],
      status: payload.status as AuthUser["status"],
    };
  } catch {
    return null;
  }
}

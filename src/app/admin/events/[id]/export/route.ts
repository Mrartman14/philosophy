// src/app/admin/events/[id]/export/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прокси для .md/.txt выгрузок события. Контент рендерит бек
 * (GET /api/admin/events/{id}.md|.txt — гейт event.read), но auth-middleware
 * бекенда принимает только Authorization: Bearer (cookie не читает) —
 * прямая браузерная ссылка получила бы 401. Роут подкладывает токен из
 * httpOnly-cookie и возвращает ответ бека как есть (включая 401/403/404).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const format =
    request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const token = (await cookies()).get("token")?.value;

  const upstream = await fetch(
    `${API_URL}/api/admin/events/${encodeURIComponent(id)}.${format}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    },
  );

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
    },
  });
}

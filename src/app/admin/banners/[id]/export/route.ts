// src/app/admin/banners/[id]/export/route.ts
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прокси для .md/.txt выгрузок баннера. Контент рендерит бек
 * (GET /api/admin/banners/{id}.md|.txt — гейт banner.read), но auth-middleware
 * бекенда принимает только Authorization: Bearer (cookie не читает) —
 * прямая браузерная ссылка получила бы 401. Роут подкладывает токен из
 * httpOnly-cookie и возвращает ответ бека как есть (включая 401/403/404).
 * Паттерн повторяет src/app/admin/events/[id]/export/route.ts.
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
    `${API_URL}/api/admin/banners/${encodeURIComponent(id)}.${format}`,
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

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/api/client";

type ExportCtx = { params: Promise<{ id: string }> };

/**
 * Общий прокси `.md/.txt`-выгрузок. Эндпоинты бека optionalAuth/гейтятся, но
 * auth-middleware читает только `Authorization: Bearer` (не cookie) — прямая
 * браузерная ссылка получила бы 401 для приватного ресурса. Роут подкладывает
 * токен из httpOnly-cookie и возвращает ответ бека как есть (включая
 * 401/403/404). `upstreamPath` строит путь бека по `id` и формату.
 *
 * @example
 *   export function GET(request: NextRequest, ctx: ExportCtx) {
 *     return proxyExport(request, ctx,
 *       (id, format) => `/api/documents/${encodeURIComponent(id)}.${format}`);
 *   }
 */
export async function proxyExport(
  request: NextRequest,
  ctx: ExportCtx,
  upstreamPath: (id: string, format: "md" | "txt") => string,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const format =
    request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const token = (await cookies()).get("token")?.value;

  const upstream = await fetch(`${API_URL}${upstreamPath(id, format)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
    },
  });
}

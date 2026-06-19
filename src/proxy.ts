import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "@/features/auth/cookie-config";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прозрачный refresh-on-demand + admin-гейт.
 *
 * Порядок обработки:
 *  1. Если access-cookie есть — пропускаем без обращения к бэку.
 *  2. Если refresh-cookie есть — пробуем обменять на свежую пару.
 *     2a. Успех → выставляем ротированную пару на ответ И в request.cookies
 *         (чтобы текущий рендер увидел новый access).
 *     2b. 4xx / сбой → удаляем обе cookie, продолжаем как гость.
 *  3. Admin-гейт: если /admin и access отсутствует → редирект на /login.
 *
 * Безопасность держит data-layer (getMe()→бэк на каждый запрос):
 * обход middleware = «refresh не случился» → гость, не дыра.
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  // --- Шаг 1: refresh-on-demand ---
  // pending — ответ, накапливающий Set-Cookie (если refresh прошёл успешно)
  let pending: NextResponse | null = null;

  if (!hasAccess && refresh) {
    const { response, refreshedAccess } = await performRefresh(request, refresh);
    pending = response;

    if (!refreshedAccess) {
      // Токен протух или сбой — возвращаем ответ с удалёнными cookie без admin-гейта
      return pending;
    }
    // refreshedAccess есть → request.cookies обновлён, pending содержит Set-Cookie
  }

  // --- Шаг 2: admin-гейт ---
  // Проверяем request.cookies — он уже обновлён после успешного refresh.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const accessNow = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
    if (!accessNow) {
      const next = encodeURIComponent(
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
    }
  }

  // Возвращаем pending (с Set-Cookie ротированной пары) или обычный next
  return pending ?? NextResponse.next({ request });
}

/**
 * Обменивает refresh-токен на новую пару.
 *
 * Всегда возвращает объект:
 * - response: NextResponse, готовый к возврату (содержит Set-Cookie или удалённые cookie).
 * - refreshedAccess: string | null — новый access-токен при успехе, null при ошибке.
 *
 * При успехе также мутирует request.cookies для текущего рендера.
 */
async function performRefresh(
  request: NextRequest,
  refresh: string,
): Promise<{ response: NextResponse; refreshedAccess: string | null }> {
  let rotated: { access: string; refresh: string; expiresIn?: number } | null = null;

  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as {
        data?: { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
      };
      const d = json.data ?? {};
      if (typeof d.access_token === "string" && typeof d.refresh_token === "string") {
        rotated = {
          access: d.access_token,
          refresh: d.refresh_token,
          ...(typeof d.expires_in === "number" && { expiresIn: d.expires_in }),
        };
      }
    }
  } catch {
    // сеть недоступна — деградируем как гость
  }

  if (!rotated) {
    // refresh невалиден/протух/сбой → чистим обе cookie
    const errRes = NextResponse.next();
    errRes.cookies.delete(ACCESS_COOKIE);
    errRes.cookies.delete(REFRESH_COOKIE);
    return { response: errRes, refreshedAccess: null };
  }

  const accessMaxAge =
    rotated.expiresIn && rotated.expiresIn > 0 ? rotated.expiresIn : ACCESS_FALLBACK_MAX_AGE;

  // Мутируем request.cookies, чтобы текущий рендер (server components) увидел новый access
  request.cookies.set(ACCESS_COOKIE, rotated.access);
  request.cookies.set(REFRESH_COOKIE, rotated.refresh);

  // Формируем ответ с Set-Cookie ротированной пары для браузера
  const successRes = NextResponse.next({ request });
  successRes.cookies.set(ACCESS_COOKIE, rotated.access, authCookieOptions(accessMaxAge));
  successRes.cookies.set(REFRESH_COOKIE, rotated.refresh, authCookieOptions(REFRESH_MAX_AGE));

  return { response: successRes, refreshedAccess: rotated.access };
}

export const config = {
  // Исключаем статику/ассеты/изображения и Next-внутренний трафик.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|css|js|woff2?)$).*)",
  ],
};

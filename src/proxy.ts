import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_FALLBACK_MAX_AGE,
  REFRESH_MAX_AGE,
  authCookieOptions,
} from "@/features/auth/cookie-config";
import { buildSecurityHeaders, type SecurityHeaders } from "@/security/csp";

const API_URL = process.env.API_URL ?? "http://localhost:8080";

/**
 * Прозрачный refresh-on-demand + admin-гейт.
 *
 * Полная история «почему так» — в дизайн-доке rbac-unification.
 * Файл совмещает admin-гейт и прозрачный refresh в одном именованном экспорте
 * `proxy` — Next 16 распознаёт middleware в proxy.ts по этому имени.
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

/**
 * Ответ, рендерящий страницу, с проставленными CSP+nonce.
 * Nonce кладётся в request-заголовок Content-Security-Policy (Next извлекает
 * его и стампит на свои скрипты) и в ответ — под именем по режиму (enforce/report-only).
 */
function pageResponse(request: NextRequest, sec: SecurityHeaders): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", sec.nonce);
  // Request-заголовок Content-Security-Policy — ТОЛЬКО для render-слоя: Next
  // извлекает из него nonce и стампит на свои скрипты. В браузер он НЕ уходит
  // (браузер видит лишь res.headers ниже). Поэтому имя тут всегда enforce-имя
  // (для извлечения nonce), а фактический режим задаёт sec.responseHeaderName на
  // ОТВЕТЕ. НЕ отражай этот request-заголовок в ответ.
  requestHeaders.set("Content-Security-Policy", sec.csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  // НЕ добавляй 'unsafe-inline' в script-src как «фолбэк»: современные браузеры
  // игнорируют его при наличии nonce, а на игнорящих nonce он заново открывает XSS.
  res.headers.set(sec.responseHeaderName, sec.csp);
  res.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  return res;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const sec = buildSecurityHeaders();
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  // --- Шаг 1: refresh-on-demand ---
  // pending — ответ, накапливающий Set-Cookie (если refresh прошёл успешно)
  let pending: NextResponse | null = null;

  if (!hasAccess && refresh) {
    const { response, refreshedAccess } = await performRefresh(request, refresh, sec);
    pending = response;

    if (!refreshedAccess) {
      // Токен протух или сбой — для /admin сразу редиректим на /login,
      // иначе продолжаем как гость (pending содержит удалённые cookie)
      if (request.nextUrl.pathname.startsWith("/admin")) {
        const next = encodeURIComponent(
          request.nextUrl.pathname + request.nextUrl.search,
        );
        const redir = NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
        redir.cookies.delete(ACCESS_COOKIE);
        redir.cookies.delete(REFRESH_COOKIE);
        return redir;
      }
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
  return pending ?? pageResponse(request, sec);
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
  sec: SecurityHeaders,
): Promise<{ response: NextResponse; refreshedAccess: string | null }> {
  let rotated: { access: string; refresh: string; expiresIn?: number } | null = null;

  try {
    // Таймаут ~3 с: зависший бэк не должен блокировать middleware на каждом запросе
    const signal =
      typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(3000)
        : (() => {
            const ctrl = new AbortController();
            setTimeout(() => {
              ctrl.abort();
            }, 3000);
            return ctrl.signal;
          })();

    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
      signal,
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
    // { request } для симметрии с успешной веткой и защиты от будущих правок
    const errRes = pageResponse(request, sec);
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
  const successRes = pageResponse(request, sec);
  successRes.cookies.set(ACCESS_COOKIE, rotated.access, authCookieOptions(accessMaxAge));
  successRes.cookies.set(REFRESH_COOKIE, rotated.refresh, authCookieOptions(REFRESH_MAX_AGE));

  return { response: successRes, refreshedAccess: rotated.access };
}

export const config = {
  // Исключаем API-роуты, статику/ассеты/изображения и Next-внутренний трафик.
  // api/ — Route Handlers не должны получать refresh-попытку через middleware.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|css|js|woff2?)$).*)",
  ],
};

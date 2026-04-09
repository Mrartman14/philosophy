import { NextRequest, NextResponse } from "next/server";

/**
 * Грубый гейт для админских роутов.
 *
 * НЕ декодирует JWT и НЕ проверяет роль — это делает `app/admin/layout.tsx`
 * через `getMe()` (вызывает реальный `/api/me` с авторитетной информацией
 * о role/status/capabilities). Здесь только отсекаем гостей, чтобы не
 * расходовать рендер на тех, кому в `/admin` явно нечего ловить.
 *
 * Полная история «почему так» — см. дизайн-док rbac-unification.
 */
export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;
  if (!token) {
    const next = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(
      new URL(`/login?next=${next}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

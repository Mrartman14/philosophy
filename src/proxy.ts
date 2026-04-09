import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware для защиты админских роутов.
 *
 * Проверка подписи JWT не выполняется — это задача API. Здесь мы только
 * декодируем payload, чтобы быстро отсечь явные случаи (нет токена,
 * нет роли admin, некорректный формат).
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const parts = token.split(".");
      const payloadPart = parts[1];
      if (!payloadPart) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
      const payload = JSON.parse(
        Buffer.from(payloadPart, "base64").toString()
      ) as { role?: string };
      if (payload.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

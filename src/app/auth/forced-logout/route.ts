// src/app/auth/forced-logout/route.ts
// Единая точка убийства сессии при бане. Сюда редиректят: root layout
// (детект на навигации через getBanSignal) и createAction/createFormAction
// (детект на мутации через BannedError). Чистит httpOnly-cookie токена,
// ставит Clear-Site-Data (defense-in-depth) и уводит на брендированный
// /login?blocked=1, где ForcedLogoutCleanup добивает локальные сторы.
import { NextResponse, type NextRequest } from "next/server";

import { getBanSignal } from "@/utils/me";

// Источник истины имени cookie — features/auth/cookie.ts (COOKIE_NAME="token").
// Литерал продублирован намеренно: route handler в app/ не может делать
// deep-import во внутренности фичи (ESLint-гард), а barrel @/features/auth
// тянет server-only-модуль.
const TOKEN_COOKIE = "token";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // CSRF-защита: деструктив (чистка cookie + Clear-Site-Data + последующий
  // wipe на /login?blocked=1) запускаем ТОЛЬКО для реально забаненного токена.
  // Не-забаненного (или гостя), которого завели сюда cross-site, тихо уводим
  // на главную — его сессия и офлайн-данные не трогаются.
  if (!(await getBanSignal())) {
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }
  const response = NextResponse.redirect(
    new URL("/login?blocked=1", request.url),
    { status: 303 },
  );
  response.cookies.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  return response;
}

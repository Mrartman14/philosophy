// src/app/auth/forced-logout/route.ts
// Единая точка убийства сессии при бане. Сюда редиректят: root layout
// (детект на навигации через getBanSignal) и createAction/createFormAction
// (детект на мутации через BannedError). Чистит httpOnly-cookie токена,
// ставит Clear-Site-Data (defense-in-depth) и уводит на брендированный
// /login?blocked=1, где ForcedLogoutCleanup добивает локальные сторы.
import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/features/auth/client";
import { getBanSignal } from "@/utils/me";

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
  // Форс-логаут ОБЯЗАН чистить ОБЕ cookie: иначе забаненный клиент сможет
  // переполучить access через живой refresh (security hole).
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("Clear-Site-Data", '"cookies", "storage"');
  return response;
}

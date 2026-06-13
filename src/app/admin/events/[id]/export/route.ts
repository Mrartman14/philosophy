// src/app/admin/events/[id]/export/route.ts
import { type NextRequest, type NextResponse } from "next/server";
import { proxyExport } from "@/utils/export-proxy";

/** Прокси `.md/.txt`-выгрузок события (admin). Логика — `@/utils/export-proxy`. */
export function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return proxyExport(
    request,
    ctx,
    (id, format) => `/api/admin/events/${encodeURIComponent(id)}.${format}`,
  );
}

// src/app/admin/banners/[id]/export/route.ts
import { type NextRequest, type NextResponse } from "next/server";
import { proxyExport } from "@/utils/export-proxy";

/** Прокси `.md/.txt`-выгрузок баннера (admin). Логика — `@/utils/export-proxy`. */
export function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return proxyExport(
    request,
    ctx,
    (id, format) => `/api/admin/banners/${encodeURIComponent(id)}.${format}`,
  );
}

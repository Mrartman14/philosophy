// src/app/api/offline/[entity]/route.ts
// Единый стабильный путь офлайн-записи (D7): same-origin, replay-safe, SW-совместим.
// Тонкий адаптер — вся логика и её тесты в @/app/_offline/offline-write.
import { NextResponse, type NextRequest } from "next/server";

import { runOfflineWrite } from "@/app/_offline/offline-write";
import { resolveDescriptor } from "@/app/_offline/registry";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ entity: string }> },
): Promise<NextResponse> {
  const { entity } = await ctx.params;
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Тело запроса не является JSON" },
      { status: 400 },
    );
  }
  const { status, body } = await runOfflineWrite(
    resolveDescriptor,
    entity,
    rawBody,
  );
  return NextResponse.json(body, { status });
}

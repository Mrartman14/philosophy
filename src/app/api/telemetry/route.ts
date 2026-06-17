// src/app/api/telemetry/route.ts
// Same-origin ingest клиентской телеметрии. Тонкий адаптер: достаём
// x-session-id + сырое тело, прогоняем через чистое ядро ingest, маппим
// статус в пустой Response. Вся логика и тесты — в @/services/observability.
import { createIngestHandler } from "@/services/observability/ingest/handle-ingest";
import { initServerObservability } from "@/services/observability/server";

const handle = createIngestHandler();

export async function POST(req: Request): Promise<Response> {
  initServerObservability();
  const sessionId = req.headers.get("x-session-id");
  const rawText = await req.text();
  const { status } = handle({ sessionId, rawText });
  if (status === 429) {
    return new Response(null, { status, headers: { "Retry-After": "1" } });
  }
  return new Response(null, { status });
}

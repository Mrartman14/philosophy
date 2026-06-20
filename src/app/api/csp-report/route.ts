// src/app/api/csp-report/route.ts
// Same-origin приёмник CSP violation-репортов. Без бэкенд-ингеста: логируем
// через серверный observability. Подробности — в дизайн-доке CSP.
import { log } from "@/services/observability";
import { initServerObservability } from "@/services/observability/server";

export async function POST(req: Request): Promise<Response> {
  initServerObservability();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  log.warn("csp.violation", { report: JSON.stringify(body).slice(0, 4000) });
  return new Response(null, { status: 204 });
}

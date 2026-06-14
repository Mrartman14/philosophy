// src/app/_offline/offline-write.ts
// Pure write-path: исполнить офлайн-команду через descriptor.write и смапить
// ActionResult в {status, body}. Резолвер инжектируется (тестируемо); реальный
// resolveDescriptor подставляет route handler. RBAC/forward — внутри write.
import type { DescriptorResolver } from "@/services/offline/repository";

export interface OfflineWriteResponse {
  status: number;
  body: unknown;
}

interface OfflineWriteBody {
  clientId: string;
  op: string;
  payload: unknown;
}

function isWriteBody(value: unknown): value is OfflineWriteBody {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.clientId === "string" &&
    record.op === "create" && // уровень 1: только create; уровень 2 (update/delete) расширит множество
    "payload" in record
  );
}

export async function runOfflineWrite(
  resolve: DescriptorResolver,
  entity: string,
  rawBody: unknown,
): Promise<OfflineWriteResponse> {
  if (!isWriteBody(rawBody)) {
    return { status: 400, body: { error: "Некорректное тело офлайн-команды" } };
  }
  const write = resolve(entity)?.write;
  if (!write) {
    return {
      status: 404,
      body: { error: `Нет офлайн-записи для сущности «${entity}»` },
    };
  }
  const result = await write(rawBody.payload, rawBody.clientId);
  if (result.success) {
    return { status: 200, body: { data: result.data } };
  }
  if (result.code === "forbidden") {
    return { status: 403, body: { error: result.error } };
  }
  if (result.code === "validation") {
    return {
      status: 422,
      body: { error: result.error, fieldErrors: result.fieldErrors },
    };
  }
  return { status: 500, body: { error: result.error } };
}

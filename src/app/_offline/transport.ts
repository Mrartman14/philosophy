// src/app/_offline/transport.ts
// Concrete транспорт синка: POST /api/offline/{entity} (same-origin) +
// маппинг HTTP → SyncSendResult. Инжектируется в drainOutbox (F3).
import type { OutboxCommand } from "@/services/offline/contract/storage";
import type {
  SyncSendResult,
  SyncTransport,
} from "@/services/offline/sync/transport";

export const offlineTransport: SyncTransport = async (
  command: OutboxCommand,
): Promise<SyncSendResult> => {
  const res = await fetch(`/api/offline/${command.entity}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      clientId: command.clientId,
      op: command.op,
      payload: command.payload,
    }),
  });

  if (res.ok) {
    let serverId: unknown;
    try {
      const json = (await res.json()) as { data?: { id?: string } };
      serverId = json.data?.id;
    } catch {
      // 2xx с не-JSON телом (напр. HTML логина после редиректа) —
      // детерминированный отказ, НЕ retriable (ретрай вернёт тот же ответ).
      return {
        ok: false,
        retriable: false,
        error: "Некорректный ответ офлайн-записи (не JSON)",
      };
    }
    if (typeof serverId !== "string") {
      return {
        ok: false,
        retriable: false,
        error: "Некорректный ответ офлайн-записи (нет id)",
      };
    }
    return { ok: true, serverId };
  }

  const retriable = res.status >= 500;
  let error = `Офлайн-запись не удалась (${res.status})`;
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json.error === "string") error = json.error;
  } catch {
    // тело не JSON — оставляем статус-сообщение
  }
  return { ok: false, retriable, error };
};

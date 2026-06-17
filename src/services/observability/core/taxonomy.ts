// src/services/observability/core/taxonomy.ts
// Классификация ЛЮБОЙ ошибки утиной типизацией. НЕТ импортов из @/utils — избегаем циклов.
import type { ErrorClass } from "./types";

export interface Classification {
  errorClass: ErrorClass;
  backendCode: string | null;
}

function asRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : null;
}

// Допустимые «хвосты» forbidden.* по контракту ErrorClass.
const FORBIDDEN_REASONS = new Set(["role", "status", "owner", "guest"]);

function messageOf(error: unknown): string {
  const rec = asRecord(error);
  const msg = rec?.message;
  return typeof msg === "string" ? msg : "";
}

export function classifyError(error: unknown): Classification {
  const rec = asRecord(error);
  const code = rec && typeof rec.code === "string" ? rec.code : null;

  if (code === "forbidden") {
    const reason =
      rec && typeof rec.reason === "string" && FORBIDDEN_REASONS.has(rec.reason)
        ? rec.reason
        : "role";
    return {
      errorClass: `forbidden.${reason}` as ErrorClass,
      backendCode: "forbidden",
    };
  }
  if (code === "banned") {
    return { errorClass: "banned", backendCode: "banned" };
  }
  if (code === "validation") {
    return { errorClass: "validation", backendCode: "validation" };
  }

  const msg = messageOf(error).toLowerCase();
  if (
    error instanceof TypeError ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  ) {
    return { errorClass: "network", backendCode: null };
  }

  return { errorClass: "unexpected", backendCode: null };
}

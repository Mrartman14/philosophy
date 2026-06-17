// src/services/observability/core/redact.ts
// Чистая редакция PII-ключей из attributes. Без crypto, без сайд-эффектов.
import type { Attributes } from "./types";

// Денилист по ключу (case-insensitive через флаг i на каждом паттерне).
export const DENY_KEY_PATTERNS: RegExp[] = [
  /token/i,
  /authorization/i,
  /password/i,
  /email/i,
  /username/i,
  /secret/i,
  /cookie/i,
];

function isDenied(key: string): boolean {
  return DENY_KEY_PATTERNS.some((re) => re.test(key));
}

export function redactAttributes(attrs: Attributes): Attributes {
  const out: Attributes = {};
  for (const key of Object.keys(attrs)) {
    if (isDenied(key)) continue;
    const value = attrs[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

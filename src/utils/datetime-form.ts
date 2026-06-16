// src/utils/datetime-form.ts
/**
 * Shared date/datetime helpers for form schema normalisation.
 * NO server-only import — usable in any layer.
 */

/** Matches bare date strings: YYYY-MM-DD. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * datetime-local ("YYYY-MM-DDTHH:mm[:ss]") → RFC3339 with Z suffix.
 * The backend requires RFC3339 for datetime fields. Input time is treated
 * as UTC — intentional MVP simplification; forms are labelled "(UTC)".
 *
 * - "YYYY-MM-DDTHH:mm"    → "YYYY-MM-DDTHH:mm:00Z"
 * - "YYYY-MM-DDTHH:mm:ss" → "YYYY-MM-DDTHH:mm:ssZ"
 * - anything else         → returned unchanged
 */
export function toRfc3339(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}Z`;
  return value;
}

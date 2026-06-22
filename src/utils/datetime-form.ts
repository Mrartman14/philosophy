// src/utils/datetime-form.ts
/**
 * Shared date/datetime helpers for form schema normalisation + edit-form
 * prefill. NO server-only import — client forms call these too.
 *
 * The backend stores datetime fields as RFC3339 (absolute instants). The admin
 * authors them via <input type="datetime-local">, which yields a timezone-naive
 * wall-clock ("YYYY-MM-DDTHH:mm"). These helpers convert between the two,
 * interpreting/rendering the wall-clock in an explicit IANA timezone (the
 * admin's own — see getServerTz), so authoring matches the rest of the app's
 * per-user timezone display. (Previously the wall-clock was forced to UTC.)
 */

/** Matches bare date strings: YYYY-MM-DD. */
export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Matches datetime-local values: YYYY-MM-DDTHH:mm (optionally with :ss). */
const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Offset of `tz` east of UTC, in ms, at the given absolute instant.
 * Intl-based, so DST-aware with no offset tables.
 */
function tzOffsetMs(tz: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const num = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value;
    return v ? Number(v) : 0;
  };
  const asUtc = Date.UTC(
    num("year"),
    num("month") - 1,
    num("day"),
    num("hour") % 24,
    num("minute"),
    num("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * datetime-local wall-clock ("YYYY-MM-DDTHH:mm[:ss]"), interpreted in `tz`,
 * → RFC3339 UTC instant ("…Z"). Non-wall-clock input (date-only,
 * already-RFC3339, garbage, "") is returned unchanged — same contract the
 * previous UTC-only helper had, so all_day date strings pass straight through.
 *
 * One offset correction is applied; for the rare wall-clock that falls in a DST
 * gap/overlap the result can be off by the transition delta. Acceptable for
 * admin scheduling; RU zones have no DST.
 */
export function wallClockToRfc3339(value: string, tz: string): string {
  const m = WALL_CLOCK_RE.exec(value);
  if (!m) return value;
  // Groups 1–5 are always present on a match; group 6 (seconds) is optional.
  // Number(undefined) → NaN, but only group 6 can be absent and it is guarded.
  const provisional = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] ? Number(m[6]) : 0,
  );
  const offset = tzOffsetMs(tz, new Date(provisional));
  // Real instant = provisional − offset (wall-clock = utc + offset).
  return new Date(provisional - offset).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * RFC3339 instant → datetime-local wall-clock ("YYYY-MM-DDTHH:mm") in `tz`,
 * for prefilling <input type="datetime-local"> in an edit form. Inverse of
 * {@link wallClockToRfc3339}. Empty/invalid → "".
 */
export function instantToWallClock(value: string | undefined, tz: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const hh = part("hour") === "24" ? "00" : part("hour");
  return `${part("year")}-${part("month")}-${part("day")}T${hh}:${part("minute")}`;
}

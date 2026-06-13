// src/features/annotations/anchor.ts
import type { Anchor } from "./types";

/**
 * Хелперы построения/валидации якоря. Зеркалят инварианты бекенда
 * (philosophy-api internal/anchor/validate.go): text-range и media-interval
 * взаимоисключающи. Фронт-валидация — defensive, финальную проверку делает
 * бек (422 ANCHOR_INVALID).
 */

interface TextAnchorInput {
  startBlockId: string;
  endBlockId: string;
  startChar: number;
  endChar: number;
  exact: string;
  prefix?: string;
  suffix?: string;
}

/** Строит text-range якорь (document / glossary / comment). */
export function buildTextAnchor(input: TextAnchorInput): Anchor {
  const anchor: Anchor = {
    start_block_id: input.startBlockId,
    end_block_id: input.endBlockId,
    start_char: input.startChar,
    end_char: input.endChar,
    exact: input.exact,
  };
  if (input.prefix) anchor.prefix = input.prefix;
  if (input.suffix) anchor.suffix = input.suffix;
  return anchor;
}

/** Строит media-interval якорь (media). endSec опционален (точечный якорь). */
export function buildMediaAnchor(startSec: number, endSec?: number): Anchor {
  const anchor: Anchor = { start_sec: startSec };
  if (endSec !== undefined) anchor.end_sec = endSec;
  return anchor;
}

function hasAnyMedia(a: Anchor): boolean {
  return a.start_sec !== undefined || a.end_sec !== undefined;
}

function hasAnyText(a: Anchor): boolean {
  return (
    !!a.start_block_id ||
    !!a.end_block_id ||
    (a.start_char ?? 0) !== 0 ||
    (a.end_char ?? 0) !== 0 ||
    !!a.exact ||
    !!a.prefix ||
    !!a.suffix
  );
}

/** Text-range валиден: оба block_id + exact, без media-полей. */
export function isValidTextAnchor(a: Anchor): boolean {
  if (hasAnyMedia(a)) return false;
  return !!a.start_block_id && !!a.end_block_id && !!a.exact;
}

/** Media-interval валиден: start_sec >= 0, end_sec (если есть) > start, без text-полей. */
export function isValidMediaAnchor(a: Anchor): boolean {
  if (hasAnyText(a)) return false;
  if (a.start_sec === undefined || a.start_sec < 0) return false;
  if (a.end_sec !== undefined && a.end_sec <= a.start_sec) return false;
  return true;
}

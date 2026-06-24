// src/features/annotations/anchor.ts
import type { TextAnchor } from "@/components/annotation-layer";

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

/**
 * Маппит доменный `annotation.Anchor` (snake_case, все поля опциональны) в
 * `TextAnchor` движка маргиналий (camelCase, char-поля обязательны).
 *
 * Возвращает `null`, если якорь не является валидным text-range:
 * - есть media-поля (`start_sec`/`end_sec`) — движок не рендерит media;
 * - неполный text-range (нет `start_block_id`/`end_block_id`/`exact`).
 *
 * Единицы (`start_char`/`end_char`) идентичны — UTF-16 code units, маппинг
 * без преобразования. Отсутствующие char-поля дефолтятся в 0.
 */
export function toEngineAnchor(a: Anchor): TextAnchor | null {
  if (a.start_sec !== undefined || a.end_sec !== undefined) return null;
  if (!a.start_block_id || !a.end_block_id || !a.exact) return null;
  const engine: TextAnchor = {
    startBlockId: a.start_block_id,
    endBlockId: a.end_block_id,
    startChar: a.start_char ?? 0,
    endChar: a.end_char ?? 0,
    exact: a.exact,
  };
  if (a.prefix) engine.prefix = a.prefix;
  if (a.suffix) engine.suffix = a.suffix;
  return engine;
}

/**
 * Маппит `TextAnchor` движка обратно в доменный `annotation.Anchor`.
 * Делегирует `buildTextAnchor` — единый источник правил опускания пустых
 * prefix/suffix.
 */
export function fromEngineAnchor(a: TextAnchor): Anchor {
  const input: TextAnchorInput = {
    startBlockId: a.startBlockId,
    endBlockId: a.endBlockId,
    startChar: a.startChar,
    endChar: a.endChar,
    exact: a.exact,
  };
  if (a.prefix) input.prefix = a.prefix;
  if (a.suffix) input.suffix = a.suffix;
  return buildTextAnchor(input);
}

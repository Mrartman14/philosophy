// src/features/annotations/anchor.ts
import type { TextAnchor } from "@/components/anchor-engine";
import { coordsToEngineAnchor, engineAnchorToCoords } from "@/utils/text-anchor";

import type { Anchor } from "./types";

/**
 * Хелперы построения/валидации якоря. Зеркалят инварианты бекенда
 * (philosophy-api internal/anchor/validate.go): text-range и media-interval
 * взаимоисключающи. Фронт-валидация — defensive, финальную проверку делает
 * бек (422 ANCHOR_INVALID).
 */

/**
 * Строит text-range якорь (document / glossary / comment) из движкового
 * `TextAnchor`. Делегирует общему `@/utils/text-anchor` — ЕДИНЫЙ источник правила
 * опускания пустых prefix/suffix (тот же, что `fromEngineAnchor`); координатный
 * объект уже валиден как `annotation.Anchor` (target-полей у аннотации нет).
 */
export function buildTextAnchor(a: TextAnchor): Anchor {
  return engineAnchorToCoords(a);
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

/**
 * Text-range валиден: оба block_id, оба node_id и exact, без media-полей.
 * node_id обязателен — anchors.md правило 1 (пустой node_id = ANCHOR_INVALID);
 * прод-данных без node_id нет, конвертер (engineAnchorToCoords) всегда его минтит.
 */
export function isValidTextAnchor(a: Anchor): boolean {
  if (hasAnyMedia(a)) return false;
  return !!a.start_block_id && !!a.end_block_id && !!a.start_node_id && !!a.end_node_id && !!a.exact;
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
  return coordsToEngineAnchor(a);
}

/**
 * Маппит `TextAnchor` движка обратно в доменный `annotation.Anchor`.
 *
 * Делегирует общему `@/utils/text-anchor` — координатный объект уже валиден
 * как `annotation.Anchor` (target-полей у аннотации нет): полная DRY, единый
 * источник правил опускания пустых prefix/suffix.
 */
export function fromEngineAnchor(a: TextAnchor): Anchor {
  return engineAnchorToCoords(a);
}

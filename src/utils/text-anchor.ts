// src/utils/text-anchor.ts
// Нейтральная координатная конверсия между snake_case-якорем бэка (общий
// субстрат annotation.Anchor / comment.Anchor) и camelCase TextAnchor движка
// маргиналий. Единицы идентичны (UTF-16 code units), без преобразования.
// Target-поля комментария (target_entity_*) НЕ касаются координат — добавляются
// доменной фичей поверх.
import type { TextAnchor } from "@/components/anchor-engine";

export interface TextAnchorCoords {
  start_block_id?: string;
  end_block_id?: string;
  start_char?: number;
  end_char?: number;
  exact?: string;
  prefix?: string;
  suffix?: string;
  start_sec?: number;
  end_sec?: number;
}

/** coords → TextAnchor движка; null если media-поля или неполный text-range. */
export function coordsToEngineAnchor(a: TextAnchorCoords): TextAnchor | null {
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

/** TextAnchor движка → координатный объект (опускает пустые prefix/suffix). */
export function engineAnchorToCoords(a: TextAnchor): TextAnchorCoords {
  const coords: TextAnchorCoords = {
    start_block_id: a.startBlockId,
    end_block_id: a.endBlockId,
    start_char: a.startChar,
    end_char: a.endChar,
    exact: a.exact,
  };
  if (a.prefix) coords.prefix = a.prefix;
  if (a.suffix) coords.suffix = a.suffix;
  return coords;
}

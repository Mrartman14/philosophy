import type { DOMOutputSpec } from "@tiptap/pm/model";

import { NODE_MAP, MARK_MAP } from "@/components/ast-content-map";

/**
 * EDIT-адаптер: единая нейтральная карта (`NODE_MAP`/`MARK_MAP`) — ОДИН
 * источник истины для node→DOM в read И edit. Редактор делегирует сюда
 * структурную базу (tag + общие attrs), а свои round-trip/editor-only атрибуты
 * накладывает СВЕРХУ в собственном `renderHTML` (карта их намеренно не несёт).
 *
 * `NeutralSpec` структурно совпадает с ProseMirror `DOMOutputSpec`
 * (`[tag, attrs, ...children]`, где `0` — content-hole), поэтому каст безопасен.
 */

/**
 * PM-нода → `DOMOutputSpec` через `NODE_MAP`. Бросает, если записи нет
 * (нода, которой нет в карте, не должна сюда делегировать).
 */
export function domSpecFromNode(name: string, attrs: Record<string, unknown>): DOMOutputSpec {
  const renderer = NODE_MAP[name as keyof typeof NODE_MAP];
  if (renderer === undefined) {
    throw new Error(`[ast] no NODE_MAP entry for "${name}"`);
  }
  return renderer({ type: name, attrs } as never) as unknown as DOMOutputSpec;
}

/**
 * Mark → структурная база `[tag, attrs]` через `MARK_MAP` (БЕЗ content-hole —
 * его добавляет вызывающий, чтобы иметь возможность слить round-trip attrs).
 * `null`, если записи нет или mark вернул пусто (например, nav-ref с пустым id).
 */
export function domSpecFromMark(
  name: string,
  attrs: Record<string, unknown>,
): [tag: string, attrs: Record<string, string>] | null {
  const renderer = MARK_MAP[name as keyof typeof MARK_MAP];
  if (renderer === undefined) {
    return null;
  }
  return renderer({ type: name, attrs } as never);
}

import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";
import { normalizeBlocks } from "@/components/ast-editor/normalize";

import { classifyBlocks } from "./classify-blocks";
import type { MergeEntry } from "./types";

/**
 * Регресс на CRITICAL баг потери данных. Юнит-тесты classify-blocks используют
 * общий хелпер p(), который ВСЕГДА выдаёт одинаковую (редакторную) форму блока
 * с заполненным `text` — поэтому они не ловят реальный продакшен-разрыв форм:
 *  - `base`/`theirs` приходят прямо из бэкенд-GET (серверная JSON-форма:
 *    произвольный порядок ключей, `text` часто отсутствует на параграфах);
 *  - `mine` приходит из сериализатора редактора (всегда `text`, фикс. порядок
 *    ключей id,type,position,[attrs],[content],text).
 * `sameContent` сравнивает через JSON.stringify → даже НЕтронутый блок выходил
 * неравным (mine-only вместо unchanged), а серверное изменение классифицировалось
 * как conflict вместо server-only → серверную правку предлагали отбросить = потеря
 * данных. Фикс: прогнать все три набора через normalizeBlocks перед classify.
 */

function statusById(entries: MergeEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) out[e.key] = e.status;
  return out;
}

/** Серверная форма (как из GET): иной порядок ключей, без `text`. */
function serverShaped(id: string, text: string): AstBlock {
  return {
    type: "paragraph",
    id,
    content: [{ type: "text", text }],
  } as AstBlock;
}

/** Редакторная форма (как из сериализатора): с `text`, канонический порядок. */
function editorShaped(id: string, text: string): AstBlock {
  return { id, type: "paragraph", position: 0, content: [{ type: "text", text }], text };
}

describe("classifyBlocks с нормализацией серверной/редакторной формы", () => {
  it("блок, который никто не менял → unchanged (а НЕ mine-only)", () => {
    const base = [serverShaped("a", "A")].map((b) => b); // server shape
    const theirs = [serverShaped("a", "A")];
    const mine = [editorShaped("a", "A")];

    const entries = classifyBlocks(
      normalizeBlocks(base),
      normalizeBlocks(mine),
      normalizeBlocks(theirs),
    );
    expect(statusById(entries)).toEqual({ a: "unchanged" });
  });

  it("блок, изменённый только на сервере → server-only (а НЕ conflict)", () => {
    const base = [serverShaped("a", "A")];
    const theirs = [serverShaped("a", "A2")]; // сервер изменил
    const mine = [editorShaped("a", "A")]; // я не трогал

    const entries = classifyBlocks(
      normalizeBlocks(base),
      normalizeBlocks(mine),
      normalizeBlocks(theirs),
    );
    expect(statusById(entries)).toEqual({ a: "server-only" });
  });
});

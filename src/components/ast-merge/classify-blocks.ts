import type { AstBlock } from "@/components/ast-editor";

import type { MergeEntry, MergeStatus } from "./types";

/** Контентное равенство блоков. `position` — это просто индекс в массиве,
 *  поэтому из сравнения исключаем. */
function sameContent(a: AstBlock | null, b: AstBlock | null): boolean {
  if (a === null || b === null) return a === b;
  const { position: _pa, ...ra } = a;
  const { position: _pb, ...rb } = b;
  return JSON.stringify(ra) === JSON.stringify(rb);
}

function indexById(blocks: AstBlock[]): Map<string, AstBlock> {
  const m = new Map<string, AstBlock>();
  for (const b of blocks) if (b.id) m.set(b.id, b);
  return m;
}

export function classifyBlocks(
  base: AstBlock[],
  mine: AstBlock[],
  theirs: AstBlock[],
): MergeEntry[] {
  const baseById = indexById(base);
  const mineById = indexById(mine);
  const theirsById = indexById(theirs);

  function statusFor(id: string): MergeStatus | null {
    const b = baseById.get(id) ?? null;
    const m = mineById.get(id) ?? null;
    const t = theirsById.get(id) ?? null;
    const inBase = b !== null;
    const inMine = m !== null;
    const inTheirs = t !== null;

    if (inMine && inTheirs) {
      const mineChanged = !sameContent(b, m);
      const theirsChanged = !sameContent(b, t);
      if (!mineChanged && !theirsChanged) return "unchanged";
      if (mineChanged && !theirsChanged) return "mine-only";
      if (!mineChanged && theirsChanged) return "server-only";
      return sameContent(m, t) ? "unchanged" : "conflict";
    }
    if (inBase && inTheirs && !inMine) {
      return sameContent(b, t) ? "removed-mine" : "structural-conflict";
    }
    if (inBase && inMine && !inTheirs) {
      return sameContent(b, m) ? "removed-server" : "structural-conflict";
    }
    if (!inBase && inTheirs && !inMine) return "added-server";
    if (!inBase && inMine && !inTheirs) return "added-mine"; // защитный (id непустой)
    return null; // в base only (удалён обеими сторонами) — пропускаем
  }

  const entryFor = (id: string, status: MergeStatus): MergeEntry => ({
    key: id,
    id,
    status,
    base: baseById.get(id) ?? null,
    mine: mineById.get(id) ?? null,
    theirs: theirsById.get(id) ?? null,
  });

  // 1. Спина результата = порядок theirs.
  const result: MergeEntry[] = [];
  const placed = new Set<string>();
  for (const t of theirs) {
    if (!t.id) continue;
    const s = statusFor(t.id);
    if (s === null) continue;
    result.push(entryFor(t.id, s));
    placed.add(t.id);
  }

  // 2. Блоки, присутствующие в mine, но не попавшие в спину (added-mine с пустым
  //    id; removed-server; structural без theirs) — вставляем после mine-предшественника.
  let lastAnchorIdx = -1;
  let addCounter = 0;
  for (const m of mine) {
    if (m.id && placed.has(m.id)) {
      lastAnchorIdx = result.findIndex((e) => e.id === m.id);
      continue;
    }
    let e: MergeEntry;
    if (!m.id) {
      e = {
        key: `mine-add#${addCounter++}`,
        id: "",
        status: "added-mine",
        base: null,
        mine: m,
        theirs: null,
      };
    } else {
      const s = statusFor(m.id);
      if (s === null) continue;
      e = entryFor(m.id, s);
    }
    const insertAt = lastAnchorIdx + 1;
    result.splice(insertAt, 0, e);
    lastAnchorIdx = insertAt;
  }

  return result;
}

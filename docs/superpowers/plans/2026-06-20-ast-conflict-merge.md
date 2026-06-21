# AST Conflict Merge — Implementation Plan

> **СТАТУС (2026-06-21): Первая волна (документы) РЕАЛИЗОВАНА на `main`.** Поблочный merge при 412 для документов (`src/components/ast-merge/*`, `AstMergeView` в форме документа) отгружен. ОТЛОЖЕНО (вторая волна, см. «Out of scope» ниже): скаляры + full-payload (`event`, `banner`), раскатка на `glossary`/`comment`/`annotation`, recreate из `gone`, structure-aware word-diff. Чекбоксы `- [ ]` ниже — история первой волны.

<!-- -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При конфликте версий (412 VERSION_MISMATCH) дать пользователю поблочно объединить свои правки со свежей серверной версией документа, ничего не теряя.

**Architecture:** Чистое entity-agnostic ядро (`classifyBlocks` / `assembleMerged` / `wordDiff`) + UI-компонент `<AstMergeView>` в новом модуле `src/components/ast-merge/`. Server action документа на 412 сам делает single-GET свежей версии и возвращает её как conflict-данные (без правки frozen-зоны `src/utils/*`). Форма документа оркестрирует: показывает merge-вью, по «Применить» грузит результат в редактор для финальной доводки.

**Tech Stack:** Next.js (App Router, server actions), React 19 (`useActionState`), TypeScript, Vitest + @testing-library/react (jsdom), Tailwind v4 (CSS-var токены), pnpm.

**Спека:** [docs/superpowers/specs/2026-06-20-ast-conflict-merge-design.md](../specs/2026-06-20-ast-conflict-merge-design.md)

## Global Constraints

- **Охват первой волны — только документ** (blocks-only endpoint). Другие сущности и скаляры — вне этого плана.
- **Git-дисциплина (AGENTS.md):** НЕ делать `git stash/reset/checkout .//clean`, НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени. Передавать это требование субагентам.
- **Запретные зоны (не трогать):** `src/api/schema.ts`, `src/utils/*`, `src/components/ui/*`, root/admin shell. Regen схемы НЕ нужен (используем существующий `GET /api/documents/{id}`).
- **Менеджер пакетов — pnpm.** Тесты: `pnpm vitest run <path>`; полный прогон `pnpm test`. Перед завершением: `pnpm lint && pnpm test && pnpm build` зелёные.
- **i18n:** UI-строки только через фасад `@/i18n` (`useT`), ключи в `src/i18n/messages/{ru,en}/documents.ts` с паритетом ru/en.
- **Версионный контракт не меняем:** 412 по-прежнему VERSION_MISMATCH; версию свежей пары берём из тела GET (`document.version`).
- **Block identity:** сопоставление блоков по стабильному `block.id` (бэкенд-присвоенный, уникален в документе); пустой `id` = добавленный мной несохранённый блок.

---

## File Structure

**Новый модуль `src/components/ast-merge/`:**

- `types.ts` — `MergeStatus`, `MergeEntry`, `MergeChoice`, `MergeDecisions`, `DiffToken`.
- `word-diff.ts` — `wordDiff(baseText, sideText): DiffToken[]` (LCS по словам).
- `classify-blocks.ts` — `classifyBlocks(base, mine, theirs): MergeEntry[]` (классификация + порядок результата).
- `assemble-merged.ts` — `assembleMerged(entries, decisions): AstBlock[]` (сборка по решениям).
- `word-diff-view.tsx` — `<WordDiffView tokens>` рендер токенов diff.
- `ast-merge-view.tsx` — `<AstMergeView>` полноэкранный takeover + `MergeViewLabels`.
- `index.ts` — barrel публичного API.
- Тесты: `word-diff.test.ts`, `classify-blocks.test.ts`, `assemble-merged.test.ts`, `ast-merge-view.test.tsx`.

**Изменения в фиче documents:**

- `src/features/documents/types.ts` — добавить `DocumentBlocksSaveResult`.
- `src/features/documents/actions.ts` — `updateDocumentBlocks`: ветка conflict (single-GET).
- `src/features/documents/update-document-blocks-conflict.test.ts` — тест ветки conflict.
- `src/features/documents/ui/document-edit-form.tsx` — оркестрация merge.
- `src/features/documents/ui/document-edit-form-conflict.test.tsx` — интеграционный тест.

**i18n:**

- `src/i18n/messages/ru/documents.ts` + `src/i18n/messages/en/documents.ts` — блок `merge`.

---

## Task 1: Merge types + word-diff (чистое ядро)

**Files:**
- Create: `src/components/ast-merge/types.ts`
- Create: `src/components/ast-merge/word-diff.ts`
- Test: `src/components/ast-merge/word-diff.test.ts`

**Interfaces:**
- Produces: `DiffToken = {type:"same"|"add"|"del"; text:string}`; `wordDiff(baseText: string, sideText: string): DiffToken[]` — `add` = есть в side, нет в base; `del` = есть в base, нет в side. Реассемблируется в исходные строки (whitespace сохраняется как токены).

- [ ] **Step 1: Создать types.ts**

```ts
// src/components/ast-merge/types.ts
import type { AstBlock } from "@/components/ast-editor";

export type MergeStatus =
  | "unchanged"
  | "mine-only"
  | "server-only"
  | "conflict"
  | "added-mine"
  | "added-server"
  | "removed-mine"
  | "removed-server"
  | "structural-conflict";

/** Один блок в модели слияния. `base/mine/theirs` — null, если блока нет на
 *  соответствующей стороне. `key` уникален в пределах списка (id или mine-add#N). */
export interface MergeEntry {
  key: string;
  id: string;
  status: MergeStatus;
  base: AstBlock | null;
  mine: AstBlock | null;
  theirs: AstBlock | null;
}

/** Для conflict/structural-conflict: какую сторону выбрал пользователь. */
export type MergeChoice = "mine" | "theirs";

/** Map: MergeEntry.key → выбор. Заполнена только для конфликтных записей. */
export type MergeDecisions = Record<string, MergeChoice>;

/** Токен пословного diff: same — без изменений, add — добавлено стороной,
 *  del — было в base и удалено стороной. */
export type DiffToken =
  | { type: "same"; text: string }
  | { type: "add"; text: string }
  | { type: "del"; text: string };
```

- [ ] **Step 2: Написать падающий тест word-diff**

```ts
// src/components/ast-merge/word-diff.test.ts
import { describe, expect, it } from "vitest";

import { wordDiff } from "./word-diff";

describe("wordDiff", () => {
  it("одинаковый текст → все same", () => {
    expect(wordDiff("hello world", "hello world")).toEqual([
      { type: "same", text: "hello" },
      { type: "same", text: " " },
      { type: "same", text: "world" },
    ]);
  });

  it("добавленное слово → add", () => {
    const tokens = wordDiff("hello world", "hello brave world");
    expect(tokens.filter((t) => t.type === "add").map((t) => t.text)).toContain(
      "brave",
    );
  });

  it("удалённое слово → del", () => {
    const tokens = wordDiff("hello brave world", "hello world");
    expect(tokens.filter((t) => t.type === "del").map((t) => t.text)).toContain(
      "brave",
    );
  });

  it("пустой base → весь side это add", () => {
    const tokens = wordDiff("", "new text");
    expect(tokens.every((t) => t.type === "add")).toBe(true);
  });

  it("реассемблируется в исходные строки", () => {
    const base = "the quick brown fox";
    const side = "the slow brown cat";
    const tokens = wordDiff(base, side);
    const reBase = tokens
      .filter((t) => t.type !== "add")
      .map((t) => t.text)
      .join("");
    const reSide = tokens
      .filter((t) => t.type !== "del")
      .map((t) => t.text)
      .join("");
    expect(reBase).toBe(base);
    expect(reSide).toBe(side);
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ast-merge/word-diff.test.ts`
Expected: FAIL — `Failed to resolve import "./word-diff"`.

- [ ] **Step 4: Реализовать word-diff.ts**

```ts
// src/components/ast-merge/word-diff.ts
import type { DiffToken } from "./types";

/** Делит строку на токены-слова и токены-пробелы, чтобы склейка была без потерь. */
function tokenize(s: string): string[] {
  return s.match(/\s+|\S+/g) ?? [];
}

/** Пословный diff на основе LCS. O(n*m) — приемлемо для текста одного блока. */
export function wordDiff(baseText: string, sideText: string): DiffToken[] {
  const a = tokenize(baseText);
  const b = tokenize(sideText);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = длина LCS суффиксов a[i:] и b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ast-merge/word-diff.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-merge/types.ts src/components/ast-merge/word-diff.ts src/components/ast-merge/word-diff.test.ts
git commit -m "feat(ast-merge): типы модели слияния + пословный word-diff"
```

---

## Task 2: classifyBlocks (классификация + порядок результата)

**Files:**
- Create: `src/components/ast-merge/classify-blocks.ts`
- Test: `src/components/ast-merge/classify-blocks.test.ts`

**Interfaces:**
- Consumes: `MergeEntry`, `MergeStatus` (Task 1).
- Produces: `classifyBlocks(base: AstBlock[], mine: AstBlock[], theirs: AstBlock[]): MergeEntry[]`. Записи в ПОРЯДКЕ РЕЗУЛЬТАТА: спина = порядок `theirs`; блоки, присутствующие только в `mine` (added-mine с пустым id; removed-server; structural без theirs), вставляются после своего mine-предшественника. Сравнение блоков игнорирует `position`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/components/ast-merge/classify-blocks.test.ts
import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { classifyBlocks } from "./classify-blocks";
import type { MergeEntry } from "./types";

function p(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text, content: [{ type: "text", text }] };
}
function statusById(entries: MergeEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) out[e.key] = e.status;
  return out;
}

describe("classifyBlocks", () => {
  it("ничего не менялось → все unchanged", () => {
    const base = [p("a", "A"), p("b", "B")];
    const entries = classifyBlocks(base, base, base);
    expect(entries.map((e) => e.status)).toEqual(["unchanged", "unchanged"]);
  });

  it("я изменил блок, сервер нет → mine-only", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A2")];
    const theirs = [p("a", "A")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "mine-only",
    });
  });

  it("сервер изменил блок, я нет → server-only", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A2")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "server-only",
    });
  });

  it("изменили оба по-разному → conflict", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A-mine")];
    const theirs = [p("a", "A-srv")];
    expect(statusById(classifyBlocks(base, mine, theirs))).toEqual({
      a: "conflict",
    });
  });

  it("изменили оба одинаково → unchanged", () => {
    const base = [p("a", "A")];
    const same = [p("a", "A-same")];
    expect(statusById(classifyBlocks(base, same, same))).toEqual({
      a: "unchanged",
    });
  });

  it("сервер добавил блок → added-server в порядке theirs", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B")];
    const entries = classifyBlocks(base, mine, theirs);
    expect(entries.map((e) => `${e.key}:${e.status}`)).toEqual([
      "a:unchanged",
      "b:added-server",
    ]);
  });

  it("я добавил несохранённый блок (пустой id) → added-mine после предшественника", () => {
    const base = [p("a", "A")];
    const mine = [p("a", "A"), { id: "", type: "paragraph", text: "NEW" }];
    const theirs = [p("a", "A")];
    const entries = classifyBlocks(base, mine, theirs);
    expect(entries.map((e) => e.status)).toEqual(["unchanged", "added-mine"]);
    expect(entries[1].mine?.text).toBe("NEW");
  });

  it("я удалил, сервер не трогал → removed-mine", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe("removed-mine");
  });

  it("сервер удалил, я не трогал → removed-server", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A"), p("b", "B")];
    const theirs = [p("a", "A")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe(
      "removed-server",
    );
  });

  it("я удалил, сервер изменил → structural-conflict", () => {
    const base = [p("a", "A"), p("b", "B")];
    const mine = [p("a", "A")];
    const theirs = [p("a", "A"), p("b", "B2")];
    expect(statusById(classifyBlocks(base, mine, theirs)).b).toBe(
      "structural-conflict",
    );
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ast-merge/classify-blocks.test.ts`
Expected: FAIL — `Failed to resolve import "./classify-blocks"`.

- [ ] **Step 3: Реализовать classify-blocks.ts**

```ts
// src/components/ast-merge/classify-blocks.ts
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
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ast-merge/classify-blocks.test.ts`
Expected: PASS (10 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-merge/classify-blocks.ts src/components/ast-merge/classify-blocks.test.ts
git commit -m "feat(ast-merge): classifyBlocks — base-aware классификация по block.id"
```

---

## Task 3: assembleMerged (сборка результата по решениям)

**Files:**
- Create: `src/components/ast-merge/assemble-merged.ts`
- Test: `src/components/ast-merge/assemble-merged.test.ts`

**Interfaces:**
- Consumes: `MergeEntry`, `MergeDecisions` (Task 1); порядок записей из `classifyBlocks` (Task 2).
- Produces: `assembleMerged(entries: MergeEntry[], decisions: MergeDecisions): AstBlock[]`. Берёт блок по статусу/решению, удаляет removed, перештампует `position` по финальному порядку.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/components/ast-merge/assemble-merged.test.ts
import { describe, expect, it } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { assembleMerged } from "./assemble-merged";
import type { MergeEntry } from "./types";

function block(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text };
}
function entry(over: Partial<MergeEntry>): MergeEntry {
  return {
    key: "k",
    id: "k",
    status: "unchanged",
    base: null,
    mine: null,
    theirs: null,
    ...over,
  };
}

describe("assembleMerged", () => {
  it("server-only/added-server берёт theirs; mine-only/added-mine берёт mine", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "server-only", theirs: block("a", "srv"), mine: block("a", "old") }),
      entry({ key: "b", status: "mine-only", mine: block("b", "mine"), theirs: block("b", "old") }),
    ];
    const out = assembleMerged(entries, {});
    expect(out.map((b) => b.text)).toEqual(["srv", "mine"]);
  });

  it("removed-* выкидываются из результата", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "unchanged", theirs: block("a", "A"), mine: block("a", "A") }),
      entry({ key: "b", status: "removed-server", mine: block("b", "B") }),
    ];
    expect(assembleMerged(entries, {}).map((b) => b.text)).toEqual(["A"]);
  });

  it("conflict: выбор theirs берёт серверный блок", () => {
    const entries: MergeEntry[] = [
      entry({ key: "c", status: "conflict", mine: block("c", "mine"), theirs: block("c", "srv") }),
    ];
    expect(assembleMerged(entries, { c: "theirs" }).map((b) => b.text)).toEqual([
      "srv",
    ]);
  });

  it("structural-conflict: я удалил, выбор mine → блок выпадает", () => {
    const entries: MergeEntry[] = [
      entry({ key: "d", status: "structural-conflict", mine: null, theirs: block("d", "srv") }),
    ];
    expect(assembleMerged(entries, { d: "mine" })).toEqual([]);
  });

  it("перештамповывает position по финальному порядку", () => {
    const entries: MergeEntry[] = [
      entry({ key: "a", status: "unchanged", theirs: block("a", "A"), mine: block("a", "A") }),
      entry({ key: "b", status: "added-server", theirs: block("b", "B") }),
    ];
    expect(assembleMerged(entries, {}).map((b) => b.position)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ast-merge/assemble-merged.test.ts`
Expected: FAIL — `Failed to resolve import "./assemble-merged"`.

- [ ] **Step 3: Реализовать assemble-merged.ts**

```ts
// src/components/ast-merge/assemble-merged.ts
import type { AstBlock } from "@/components/ast-editor";

import type { MergeDecisions, MergeEntry } from "./types";

/** Собирает итоговые блоки по статусам и решениям пользователя. Removed-блоки
 *  выпадают; для conflict/structural берётся выбранная сторона. position
 *  перештамповывается по финальному порядку (бэкенд использует position как индекс). */
export function assembleMerged(
  entries: MergeEntry[],
  decisions: MergeDecisions,
): AstBlock[] {
  const out: AstBlock[] = [];
  for (const e of entries) {
    switch (e.status) {
      case "unchanged":
      case "server-only":
      case "added-server":
        if (e.theirs) out.push(e.theirs);
        else if (e.mine) out.push(e.mine);
        break;
      case "mine-only":
      case "added-mine":
        if (e.mine) out.push(e.mine);
        break;
      case "removed-mine":
      case "removed-server":
        break; // чистое удаление — выбрасываем
      case "conflict":
      case "structural-conflict": {
        const choice = decisions[e.key];
        if (choice === "theirs" && e.theirs) out.push(e.theirs);
        else if (choice === "mine" && e.mine) out.push(e.mine);
        // structural, где выбранная сторона = null (принятое удаление) → ничего
        break;
      }
    }
  }
  return out.map((b, i) => ({ ...b, position: i }));
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ast-merge/assemble-merged.test.ts`
Expected: PASS (5 тестов).

- [ ] **Step 5: Commit**

```bash
git add src/components/ast-merge/assemble-merged.ts src/components/ast-merge/assemble-merged.test.ts
git commit -m "feat(ast-merge): assembleMerged — сборка блоков по решениям + перештамп position"
```

---

## Task 4: WordDiffView + barrel index

**Files:**
- Create: `src/components/ast-merge/word-diff-view.tsx`
- Create: `src/components/ast-merge/index.ts`

**Interfaces:**
- Consumes: `DiffToken` (Task 1).
- Produces: `<WordDiffView tokens={DiffToken[]} />`; barrel `@/components/ast-merge` ре-экспортит `classifyBlocks`, `assembleMerged`, `wordDiff`, `AstMergeView`, типы и `MergeViewLabels`.

- [ ] **Step 1: Реализовать word-diff-view.tsx**

```tsx
// src/components/ast-merge/word-diff-view.tsx
import type { DiffToken } from "./types";

/** Рендер пословного diff: add — зелёным, del — красным зачёркнутым. */
export function WordDiffView({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="whitespace-pre-wrap text-sm">
      {tokens.map((tok, i) => {
        if (tok.type === "add") {
          return (
            <span key={i} className="rounded-sm bg-green-100 text-green-800">
              {tok.text}
            </span>
          );
        }
        if (tok.type === "del") {
          return (
            <span
              key={i}
              className="rounded-sm bg-red-100 text-red-800 line-through"
            >
              {tok.text}
            </span>
          );
        }
        return <span key={i}>{tok.text}</span>;
      })}
    </p>
  );
}
```

- [ ] **Step 2: Создать barrel index.ts**

```ts
// src/components/ast-merge/index.ts
export { classifyBlocks } from "./classify-blocks";
export { assembleMerged } from "./assemble-merged";
export { wordDiff } from "./word-diff";
export { WordDiffView } from "./word-diff-view";
export { AstMergeView } from "./ast-merge-view";
export type { MergeViewLabels } from "./ast-merge-view";
export type {
  MergeStatus,
  MergeEntry,
  MergeChoice,
  MergeDecisions,
  DiffToken,
} from "./types";
```

> Примечание: `index.ts` ссылается на `./ast-merge-view` (Task 5). До Task 5 barrel не импортируется ни одним потребителем, поэтому компиляция отдельных модулей не ломается; полный `pnpm build` гоняем в конце Task 5.

- [ ] **Step 3: Проверить, что модуль типизируется**

Run: `pnpm vitest run src/components/ast-merge/word-diff.test.ts src/components/ast-merge/classify-blocks.test.ts src/components/ast-merge/assemble-merged.test.ts`
Expected: PASS (все три файла зелёные — регресс-проверка, что ничего не сломали).

- [ ] **Step 4: Commit**

```bash
git add src/components/ast-merge/word-diff-view.tsx src/components/ast-merge/index.ts
git commit -m "feat(ast-merge): WordDiffView + barrel публичного API"
```

---

## Task 5: AstMergeView (полноэкранный merge-вью)

**Files:**
- Create: `src/components/ast-merge/ast-merge-view.tsx`
- Test: `src/components/ast-merge/ast-merge-view.test.tsx`

**Interfaces:**
- Consumes: `classifyBlocks`, `assembleMerged`, `wordDiff`, `WordDiffView`, типы; `AstRender` из `@/components/ast-render`; `Button` из `@/components/ui`.
- Produces: `<AstMergeView base mine theirs labels onApply onCancel />`; `interface MergeViewLabels` (плоский объект строк). `onApply(blocks: AstBlock[])` вызывается при «Применить» с собранным результатом; кнопка «Применить» заблокирована, пока не решены все конфликты.

- [ ] **Step 1: Написать падающий тест**

```tsx
// src/components/ast-merge/ast-merge-view.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

import { AstMergeView, type MergeViewLabels } from "./ast-merge-view";

vi.mock("@/components/ast-render", () => ({
  AstRender: ({ blocks }: { blocks: AstBlock[] }) => (
    <div data-testid="ast-render">{blocks.map((b) => b.text).join("")}</div>
  ),
}));
vi.mock("@/components/ui", () => ({
  Button: (props: Record<string, unknown>) => <button {...props} />,
}));

const labels: MergeViewLabels = {
  title: "T",
  intro: "I",
  badgeServerChanged: "srv-changed",
  badgeYourEdit: "your-edit",
  badgeAddedByYou: "added-you",
  badgeAddedOnServer: "added-srv",
  badgeRemovedByYou: "removed-you",
  badgeRemovedOnServer: "removed-srv",
  conflictHeading: "conflict-pick",
  optionServer: "opt-srv",
  optionMine: "opt-mine",
  unchangedLabel: "unchanged",
  applyButton: "apply",
  cancelButton: "cancel",
};
function p(id: string, text: string): AstBlock {
  return { id, type: "paragraph", text };
}

afterEach(cleanup);

describe("AstMergeView", () => {
  it("кнопка apply заблокирована, пока конфликт не решён, и onApply отдаёт выбранную сторону", () => {
    const onApply = vi.fn();
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A-mine")]}
        theirs={[p("a", "A-srv")]}
        labels={labels}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    const apply = screen.getByText("apply");
    expect(apply).toBeDisabled();

    // выбрать серверную версию конфликта
    fireEvent.click(screen.getByLabelText("opt-srv"));
    expect(apply).not.toBeDisabled();

    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].map((b: AstBlock) => b.text)).toEqual([
      "A-srv",
    ]);
  });

  it("onCancel вызывается по кнопке cancel", () => {
    const onCancel = vi.fn();
    render(
      <AstMergeView
        base={[p("a", "A")]}
        mine={[p("a", "A")]}
        theirs={[p("a", "A")]}
        labels={labels}
        onApply={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ast-merge/ast-merge-view.test.tsx`
Expected: FAIL — `Failed to resolve import "./ast-merge-view"`.

- [ ] **Step 3: Реализовать ast-merge-view.tsx**

```tsx
// src/components/ast-merge/ast-merge-view.tsx
"use client";
import { useMemo, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { AstRender } from "@/components/ast-render";
import { Button } from "@/components/ui";

import { assembleMerged } from "./assemble-merged";
import { classifyBlocks } from "./classify-blocks";
import type { MergeChoice, MergeDecisions, MergeEntry, MergeStatus } from "./types";
import { wordDiff } from "./word-diff";
import { WordDiffView } from "./word-diff-view";

/** Плоский набор локализованных строк — компонент i18n-агностичен, строки
 *  приходят пропом из потребляющей формы (namespace сущности). */
export interface MergeViewLabels {
  title: string;
  intro: string;
  badgeServerChanged: string;
  badgeYourEdit: string;
  badgeAddedByYou: string;
  badgeAddedOnServer: string;
  badgeRemovedByYou: string;
  badgeRemovedOnServer: string;
  conflictHeading: string;
  optionServer: string;
  optionMine: string;
  unchangedLabel: string;
  applyButton: string;
  cancelButton: string;
}

interface Props {
  base: AstBlock[];
  mine: AstBlock[];
  theirs: AstBlock[];
  labels: MergeViewLabels;
  onApply: (blocks: AstBlock[]) => void;
  onCancel: () => void;
}

const CONFLICT: ReadonlySet<MergeStatus> = new Set([
  "conflict",
  "structural-conflict",
]);

function badgeFor(status: MergeStatus, l: MergeViewLabels): string | null {
  switch (status) {
    case "server-only":
      return l.badgeServerChanged;
    case "mine-only":
      return l.badgeYourEdit;
    case "added-mine":
      return l.badgeAddedByYou;
    case "added-server":
      return l.badgeAddedOnServer;
    case "removed-mine":
      return l.badgeRemovedByYou;
    case "removed-server":
      return l.badgeRemovedOnServer;
    default:
      return null;
  }
}

export function AstMergeView({
  base,
  mine,
  theirs,
  labels,
  onApply,
  onCancel,
}: Props) {
  const entries = useMemo(
    () => classifyBlocks(base, mine, theirs),
    [base, mine, theirs],
  );
  const [decisions, setDecisions] = useState<MergeDecisions>({});

  const conflicts = entries.filter((e) => CONFLICT.has(e.status));
  const allDecided = conflicts.every((e) => decisions[e.key]);
  const unchangedN = entries.filter((e) => e.status === "unchanged").length;
  const visible = entries.filter((e) => e.status !== "unchanged");

  function choose(key: string, choice: MergeChoice) {
    setDecisions((d) => ({ ...d, [key]: choice }));
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-(--color-surface) p-6"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold">{labels.title}</h2>
          <p className="text-sm text-(--color-fg-muted)">{labels.intro}</p>
        </header>

        {unchangedN > 0 && (
          <p className="text-sm text-(--color-fg-muted)">
            {unchangedN} {labels.unchangedLabel}
          </p>
        )}

        <ol className="flex flex-col gap-4">
          {visible.map((e) => (
            <li key={e.key}>
              <EntryView
                entry={e}
                labels={labels}
                choice={decisions[e.key]}
                onChoose={(c) => {
                  choose(e.key, c);
                }}
              />
            </li>
          ))}
        </ol>

        <footer className="sticky bottom-0 flex gap-3 bg-(--color-surface) py-3">
          <Button
            type="button"
            disabled={!allDecided}
            onClick={() => {
              onApply(assembleMerged(entries, decisions));
            }}
          >
            {labels.applyButton}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {labels.cancelButton}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function EntryView({
  entry,
  labels,
  choice,
  onChoose,
}: {
  entry: MergeEntry;
  labels: MergeViewLabels;
  choice: MergeChoice | undefined;
  onChoose: (c: MergeChoice) => void;
}) {
  const baseText = entry.base?.text ?? "";

  if (CONFLICT.has(entry.status)) {
    return (
      <div className="rounded border border-(--color-border) p-3">
        <p className="mb-2 text-sm font-medium text-red-600">
          {labels.conflictHeading}
        </p>
        <label className="mb-2 flex gap-2">
          <input
            type="radio"
            name={entry.key}
            aria-label={labels.optionServer}
            checked={choice === "theirs"}
            onChange={() => {
              onChoose("theirs");
            }}
          />
          <div>
            <span className="text-xs text-(--color-fg-muted)">
              {labels.optionServer}
            </span>
            {entry.theirs && <AstRender blocks={[entry.theirs]} />}
            {entry.theirs && (
              <WordDiffView tokens={wordDiff(baseText, entry.theirs.text ?? "")} />
            )}
          </div>
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name={entry.key}
            aria-label={labels.optionMine}
            checked={choice === "mine"}
            onChange={() => {
              onChoose("mine");
            }}
          />
          <div>
            <span className="text-xs text-(--color-fg-muted)">
              {labels.optionMine}
            </span>
            {entry.mine && <AstRender blocks={[entry.mine]} />}
            {entry.mine && (
              <WordDiffView tokens={wordDiff(baseText, entry.mine.text ?? "")} />
            )}
          </div>
        </label>
      </div>
    );
  }

  const block = entry.theirs ?? entry.mine;
  const badge = badgeFor(entry.status, labels);
  const removed =
    entry.status === "removed-mine" || entry.status === "removed-server";

  return (
    <div className="rounded border border-(--color-border) p-3">
      {badge && (
        <span className="mb-1 inline-block text-xs text-(--color-fg-muted)">
          {badge}
        </span>
      )}
      <div className={removed ? "line-through opacity-50" : undefined}>
        {block && <AstRender blocks={[block]} />}
        {entry.status === "server-only" && entry.theirs && (
          <WordDiffView
            tokens={wordDiff(baseText, entry.theirs.text ?? "")}
          />
        )}
      </div>
    </div>
  );
}
```

> Если у `Button` из `@/components/ui` нет пропа `variant="ghost"` — убрать его (вторая кнопка останется дефолтной). Проверить сигнатуру `Button` перед реализацией; тест мокает `Button` как `<button>`, поэтому на тест это не влияет.

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ast-merge/ast-merge-view.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 5: Прогнать lint + build модуля**

Run: `pnpm lint && pnpm vitest run src/components/ast-merge`
Expected: lint без ошибок; все тесты модуля зелёные.

- [ ] **Step 6: Commit**

```bash
git add src/components/ast-merge/ast-merge-view.tsx src/components/ast-merge/ast-merge-view.test.tsx
git commit -m "feat(ast-merge): AstMergeView — полноэкранный поблочный merge с word-diff"
```

---

## Task 6: Server action — ветка conflict (single-GET свежей версии)

**Files:**
- Modify: `src/features/documents/types.ts` (добавить тип результата)
- Modify: `src/features/documents/actions.ts:153-171` (`updateDocumentBlocks`)
- Test: `src/features/documents/update-document-blocks-conflict.test.ts`

**Interfaces:**
- Consumes: `getDocumentById` из `./api`; `AstBlock`.
- Produces: `DocumentBlocksSaveResult = {kind:"saved";document:Document|null} | {kind:"conflict";theirs:{blocks:AstBlock[];version:number}} | {kind:"gone"}`. `updateDocumentBlocks` возвращает `ActionResult<DocumentBlocksSaveResult>`: на 412 делает `getDocumentById(id)` и отдаёт conflict (или gone, если документ исчез).

- [ ] **Step 1: Добавить тип в types.ts**

Добавить в конец `src/features/documents/types.ts` (перед закрытием файла) импорт и тип:

```ts
import type { AstBlock } from "@/components/ast-editor";

/** Результат updateDocumentBlocks. `conflict` несёт свежую серверную пару
 *  blocks+version (single-GET после 412); `gone` — документ удалён в другом месте. */
export type DocumentBlocksSaveResult =
  | { kind: "saved"; document: Document | null }
  | { kind: "conflict"; theirs: { blocks: AstBlock[]; version: number } }
  | { kind: "gone" };
```

> `import type` поднять к остальным импортам в начало файла (там сейчас только `import type { components } from "@/api/schema";`). Тип `Document` уже объявлен в этом файле.

- [ ] **Step 2: Написать падающий тест ветки conflict**

```ts
// src/features/documents/update-document-blocks-conflict.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// updateDocumentBlocks на 412 делает single-GET свежей версии и возвращает
// conflict-данные (см. spec 2026-06-20-ast-conflict-merge-design.md).
const put = vi.fn();
const getDocumentById = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("./api", () => ({ getDocumentById }));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return { ...actual, getT: () => Promise.resolve((key: string) => key) };
});

import { updateDocumentBlocks } from "./actions";

const initial = { success: true as const, data: { kind: "saved" as const, document: null } };
const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function blocksForm(version: string): FormData {
  const fd = new FormData();
  fd.set("id", ID);
  fd.set("blocks", JSON.stringify([{ id: "a", type: "paragraph", text: "mine" }]));
  fd.set("version", version);
  return fd;
}

describe("updateDocumentBlocks — ветка conflict", () => {
  beforeEach(() => {
    put.mockReset();
    getDocumentById.mockReset();
  });

  it("412 → single-GET → kind:conflict со свежими blocks+version", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    getDocumentById.mockResolvedValue({
      id: ID,
      version: 8,
      blocks: [{ id: "a", type: "paragraph", text: "server" }],
    });

    const result = await updateDocumentBlocks(initial, blocksForm("5"));

    expect(getDocumentById).toHaveBeenCalledWith(ID);
    expect(result).toEqual({
      success: true,
      data: {
        kind: "conflict",
        theirs: {
          blocks: [{ id: "a", type: "paragraph", text: "server" }],
          version: 8,
        },
      },
    });
  });

  it("412, но документ исчез при рефетче → kind:gone", async () => {
    put.mockResolvedValue({
      data: undefined,
      error: { code: "VERSION_MISMATCH", error: "version mismatch" },
    });
    getDocumentById.mockResolvedValue(null);

    const result = await updateDocumentBlocks(initial, blocksForm("5"));
    expect(result).toEqual({ success: true, data: { kind: "gone" } });
  });

  it("успех → kind:saved с документом", async () => {
    put.mockResolvedValue({ data: { data: { id: ID, version: 6 } }, error: undefined });
    const result = await updateDocumentBlocks(initial, blocksForm("5"));
    expect(result).toEqual({
      success: true,
      data: { kind: "saved", document: { id: ID, version: 6 } },
    });
    expect(getDocumentById).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/features/documents/update-document-blocks-conflict.test.ts`
Expected: FAIL (текущая реализация бросает на 412 → result не `kind:conflict`).

- [ ] **Step 4: Изменить updateDocumentBlocks**

В `src/features/documents/actions.ts` добавить импорты (к существующим):

```ts
import { getDocumentById } from "./api";
import type { Document, DocumentBlocksSaveResult } from "./types";
```

> Текущая строка `import type { Document } from "./types";` заменить на строку с двумя именами выше.

Заменить тело `updateDocumentBlocks` (строки ~153–171) на:

```ts
export const updateDocumentBlocks = createFormAction(
  async (formData, ctx): Promise<DocumentBlocksSaveResult> => {
    const me = await getMe();
    requireActive(me);
    const t = await getT("validation");
    const input = parseFormData(makeDocumentBlocksSchema(t), formData);
    const api = await createApiClient();
    const { data, error } = await api.PUT("/api/documents/{document_id}/blocks", {
      params: {
        path: { document_id: input.id },
        header: ifMatchHeader(formData, "документа"),
      },
      body: { blocks: input.blocks },
      headers: idempotencyHeaders(ctx.idempotencyKey),
    });
    if (error) {
      // Конфликт версий: тянем свежую серверную пару blocks+version (single-GET)
      // и отдаём её как conflict-данные — форма откроет merge-вью. Версию берём
      // из тела GET (согласованная пара), а не из ETag 412.
      if (error.code === "VERSION_MISMATCH") {
        const fresh = await getDocumentById(input.id);
        if (!fresh) return { kind: "gone" };
        return {
          kind: "conflict",
          theirs: { blocks: fresh.blocks ?? [], version: fresh.version ?? 0 },
        };
      }
      rethrowApiError(error, ERRORS);
    }
    revalidateEntity(Tags.DOCUMENTS, input.id);
    revalidateEntity(Tags.DOCUMENTS);
    return { kind: "saved", document: unwrap(data) };
  },
  "updateDocumentBlocks",
);
```

- [ ] **Step 5: Запустить новый тест + регресс optlock**

Run: `pnpm vitest run src/features/documents/update-document-blocks-conflict.test.ts src/features/documents/update-document-blocks-optlock.test.ts`
Expected: PASS — новый тест (3) зелёный И существующий optlock-тест (2) не сломан (If-Match по-прежнему шлётся, 428-guard работает).

- [ ] **Step 6: Commit**

```bash
git add src/features/documents/types.ts src/features/documents/actions.ts src/features/documents/update-document-blocks-conflict.test.ts
git commit -m "feat(documents): updateDocumentBlocks возвращает conflict со свежей версией (single-GET на 412)"
```

---

## Task 7: i18n — строки merge-вью (ru/en)

**Files:**
- Modify: `src/i18n/messages/ru/documents.ts`
- Modify: `src/i18n/messages/en/documents.ts`

**Interfaces:**
- Produces: ключи `documents.merge.*` (паритет ru/en), потребляются формой (Task 8) и пробрасываются в `MergeViewLabels`.

- [ ] **Step 1: Добавить блок merge в ru/documents.ts**

Вставить перед `// --- api.ts: fetch error fallbacks ...` (т.е. перед полем `api:`):

```ts
  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "Документ изменён в другом месте",
    intro:
      "Пока вы редактировали, документ сохранил другой пользователь. Объедините изменения поблочно.",
    badgeServerChanged: "изменено на сервере",
    badgeYourEdit: "ваша правка",
    badgeAddedByYou: "добавлено вами",
    badgeAddedOnServer: "добавлено на сервере",
    badgeRemovedByYou: "удалено вами",
    badgeRemovedOnServer: "удалено на сервере",
    conflictHeading: "Конфликт — выберите версию блока",
    optionServer: "Серверная версия",
    optionMine: "Ваша версия",
    unchangedLabel: "блоков без изменений",
    applyButton: "Применить и продолжить",
    cancelButton: "Отмена",
    goneMessage:
      "Документ был удалён в другом месте. Скопируйте свои правки и обновите страницу.",
  },
```

- [ ] **Step 2: Добавить зеркальный блок в en/documents.ts**

Вставить в `src/i18n/messages/en/documents.ts` перед полем `api:`:

```ts
  // --- conflict merge (AstMergeView) ---
  merge: {
    title: "Document changed elsewhere",
    intro:
      "While you were editing, another user saved this document. Merge the changes block by block.",
    badgeServerChanged: "changed on server",
    badgeYourEdit: "your edit",
    badgeAddedByYou: "added by you",
    badgeAddedOnServer: "added on server",
    badgeRemovedByYou: "removed by you",
    badgeRemovedOnServer: "removed on server",
    conflictHeading: "Conflict — choose a block version",
    optionServer: "Server version",
    optionMine: "Your version",
    unchangedLabel: "blocks unchanged",
    applyButton: "Apply and continue",
    cancelButton: "Cancel",
    goneMessage:
      "The document was deleted elsewhere. Copy your edits and reload the page.",
  },
```

- [ ] **Step 3: Проверить паритет ключей через typecheck**

Run: `pnpm typecheck`
Expected: PASS — нет ошибок паритета ru/en (`satisfies Messages` / тип-паритет не нарушен).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages/ru/documents.ts src/i18n/messages/en/documents.ts
git commit -m "feat(i18n): строки merge-вью конфликта документов (ru/en)"
```

---

## Task 8: Оркестрация в форме редактирования документа

**Files:**
- Modify: `src/features/documents/ui/document-edit-form.tsx`
- Test: `src/features/documents/ui/document-edit-form-conflict.test.tsx`

**Interfaces:**
- Consumes: `AstMergeView`, `MergeViewLabels` из `@/components/ast-merge`; `DocumentBlocksSaveResult` (Task 6); строки `documents.merge.*` (Task 7).
- Produces: при conflict-результате форма показывает `<AstMergeView>`; по `onApply` грузит merged-блоки в редактор (перемонтирование по `key`), обновляет base/version на свежую серверную; gone → сообщение.

- [ ] **Step 1: Написать падающий интеграционный тест**

```tsx
// src/features/documents/ui/document-edit-form-conflict.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AstBlock } from "@/components/ast-editor";

const updateDocumentBlocks = vi.hoisted(() => vi.fn());

vi.mock("../actions", () => ({ updateDocumentBlocks }));
vi.mock("@/components/ast-editor/lazy-ast-editor", () => ({
  LazyAstEditor: () => <div data-testid="editor" />,
}));
vi.mock("@/components/ast-merge", () => ({
  AstMergeView: ({ onApply }: { onApply: (b: AstBlock[]) => void }) => (
    <div data-testid="merge-view">
      <button
        onClick={() => {
          onApply([{ id: "a", type: "paragraph", text: "merged" }]);
        }}
      >
        apply
      </button>
    </div>
  ),
}));
vi.mock("@/components/ui", () => ({
  Form: ({ action, children }: { action: (fd: FormData) => void; children: React.ReactNode }) => (
    <form action={action as never}>{children}</form>
  ),
  FormField: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  IdempotencyField: () => null,
  SubmitButton: ({ children }: { children: React.ReactNode }) => (
    <button type="submit">{children}</button>
  ),
}));
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { DocumentEditForm } from "./document-edit-form";

const doc = { id: "d1", version: 5, blocks: [{ id: "a", type: "paragraph", text: "base" }] };

afterEach(() => {
  cleanup();
  updateDocumentBlocks.mockReset();
});

describe("DocumentEditForm — конфликт версий", () => {
  it("conflict-результат показывает merge-вью; apply обновляет hidden version", async () => {
    updateDocumentBlocks.mockResolvedValue({
      success: true,
      data: {
        kind: "conflict",
        theirs: { blocks: [{ id: "a", type: "paragraph", text: "server" }], version: 8 },
      },
    });

    const { container } = render(<DocumentEditForm document={doc as never} />);
    expect(container.querySelector('input[name="version"]')).toHaveValue("5");

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByTestId("merge-view")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("merge-view")).not.toBeInTheDocument();
    });
    // версия обновлена на свежую серверную (8) для следующего сохранения
    expect(container.querySelector('input[name="version"]')).toHaveValue("8");
  });

  it("gone-результат показывает сообщение об удалении", async () => {
    updateDocumentBlocks.mockResolvedValue({
      success: true,
      data: { kind: "gone" },
    });
    const { container } = render(<DocumentEditForm document={doc as never} />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => {
      expect(screen.getByText("merge.goneMessage")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/features/documents/ui/document-edit-form-conflict.test.tsx`
Expected: FAIL (текущая форма не обрабатывает conflict/gone, merge-вью не появляется).

- [ ] **Step 3: Переписать document-edit-form.tsx**

```tsx
"use client";
// src/features/documents/ui/document-edit-form.tsx
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { LazyAstEditor } from "@/components/ast-editor/lazy-ast-editor";
import { AstMergeView, type MergeViewLabels } from "@/components/ast-merge";
import { Form, FormField, IdempotencyField, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { updateDocumentBlocks } from "../actions";
import type { Document, DocumentBlocksSaveResult } from "../types";

const initial: ActionResult<DocumentBlocksSaveResult> = {
  success: true,
  data: { kind: "saved", document: null },
};

interface Props {
  document: Document;
}

export function DocumentEditForm({ document }: Props) {
  const t = useT("documents");
  const tErrors = useT("errors");

  // base — версия, от которой произведены текущие правки (обновляется после merge)
  const [baseBlocks, setBaseBlocks] = useState<AstBlock[]>(document.blocks ?? []);
  const [baseVersion, setBaseVersion] = useState<number | undefined>(
    document.version,
  );
  // источник defaultValue редактора + ключ для перемонтирования при загрузке merged
  const [editorSeed, setEditorSeed] = useState<AstBlock[]>(document.blocks ?? []);
  const [editorKey, setEditorKey] = useState(0);
  // текущее содержимое редактора (mine)
  const [blocks, setBlocks] = useState<AstBlock[]>(document.blocks ?? []);

  const [conflict, setConflict] = useState<
    { blocks: AstBlock[]; version: number } | null
  >(null);
  const [gone, setGone] = useState(false);

  const [state, action] = useActionState(updateDocumentBlocks, initial);

  useEffect(() => {
    if (!state.success) return;
    if (state.data.kind === "conflict") {
      setConflict(state.data.theirs);
    } else if (state.data.kind === "gone") {
      setGone(true);
    } else if (state.data.kind === "saved" && state.data.document) {
      // успешное сохранение — синхронизируем base со свежей серверной версией
      setBaseVersion(state.data.document.version);
      setBaseBlocks(state.data.document.blocks ?? []);
    }
  }, [state]);

  const mergeLabels: MergeViewLabels = {
    title: t("merge.title"),
    intro: t("merge.intro"),
    badgeServerChanged: t("merge.badgeServerChanged"),
    badgeYourEdit: t("merge.badgeYourEdit"),
    badgeAddedByYou: t("merge.badgeAddedByYou"),
    badgeAddedOnServer: t("merge.badgeAddedOnServer"),
    badgeRemovedByYou: t("merge.badgeRemovedByYou"),
    badgeRemovedOnServer: t("merge.badgeRemovedOnServer"),
    conflictHeading: t("merge.conflictHeading"),
    optionServer: t("merge.optionServer"),
    optionMine: t("merge.optionMine"),
    unchangedLabel: t("merge.unchangedLabel"),
    applyButton: t("merge.applyButton"),
    cancelButton: t("merge.cancelButton"),
  };

  function applyMerge(merged: AstBlock[]) {
    setEditorSeed(merged);
    setBlocks(merged);
    setEditorKey((k) => k + 1); // перемонтировать редактор с новым defaultValue
    if (conflict) {
      setBaseBlocks(conflict.blocks);
      setBaseVersion(conflict.version);
    }
    setConflict(null);
  }

  if (gone) {
    return <p className="text-sm text-red-600">{t("merge.goneMessage")}</p>;
  }

  return (
    <>
      <Form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={document.id ?? ""} />
        <input type="hidden" name="version" value={baseVersion ?? ""} />
        <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <FormField name="blocks" label={t("contentLabel")}>
          <LazyAstEditor
            key={editorKey}
            defaultValue={editorSeed}
            entityContext="document"
            onChange={(next: AstBlock[]) => {
              setBlocks(next);
            }}
          />
        </FormField>

        {state.success &&
          state.data.kind === "saved" &&
          state.data.document && (
            <p className="text-sm text-(--color-fg-muted)">{t("savedMessage")}</p>
          )}
        {!state.success && state.code === "forbidden" && (
          <p className="text-sm text-red-600">
            {tErrors("forbiddenAction", { action: t("editForbiddenAction") })}
          </p>
        )}
        {!state.success && !state.code && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <div>
          <SubmitButton>{t("saveContentButton")}</SubmitButton>
        </div>
      </Form>

      {conflict && (
        <AstMergeView
          base={baseBlocks}
          mine={blocks}
          theirs={conflict.blocks}
          labels={mergeLabels}
          onApply={applyMerge}
          onCancel={() => {
            setConflict(null);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/features/documents/ui/document-edit-form-conflict.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 5: Полная проверка перед завершением**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Если `pnpm build` ругается на неиспользуемый `variant` у `Button` или иные TS-ошибки — поправить точечно (см. примечание в Task 5 Step 3).

- [ ] **Step 6: Commit**

```bash
git add src/features/documents/ui/document-edit-form.tsx src/features/documents/ui/document-edit-form-conflict.test.tsx
git commit -m "feat(documents): merge-оркестрация формы — конфликт → AstMergeView → доводка в редакторе"
```

---

## Вне охвата этого плана (зафиксировано в спеке)

- Скалярные поля и полнопейлоадные сущности (`event`, `banner`) — вторая волна + мини-механизм скаляров.
- Раскатка merge на `glossary` / `comment` / `annotation` (для `comment` сначала regen `schema.ts` под новый `GET /api/comments/{id}`).
- Авто-recreate документа из состояния `gone` (сейчас — сообщение + ручное обновление).
- Структурный mark-aware word-diff (в MVP — текстовый).

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** §ядро diff/merge → Tasks 1–3; §word-diff → Task 1; §merge-UI → Tasks 4–5; §источники данных (single-GET на 412) → Task 6; §сквозной поток + порядок + краевые (gone) → Task 8; §тестирование → тесты в каждой задаче. Скаляры/вторая волна — явно вне охвата.
- **Плейсхолдеры:** отсутствуют — во всех шагах полный код и точные команды.
- **Согласованность типов:** `MergeEntry`/`MergeDecisions`/`DiffToken` (Task 1) едины во всех задачах; `classifyBlocks`/`assembleMerged`/`wordDiff` сигнатуры совпадают между ядром (Tasks 2–3) и UI (Task 5); `DocumentBlocksSaveResult` (Task 6) совпадает с потреблением в форме (Task 8); ключи `MergeViewLabels` совпадают между Task 5, Task 7 (i18n) и Task 8.

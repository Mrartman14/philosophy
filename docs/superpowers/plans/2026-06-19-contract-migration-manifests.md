# Контракт-миграция — Plan C (Freshness-манифесты) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Подключить freshness-манифест нового бэка к существующей offline-ревалидации лекции: вместо полного GET лекции — дешёвый `GET /api/lectures/{id}/manifest` с `If-None-Match`→304.

**Architecture:** Read-side SWR. У офлайн-кеша лекции уже есть рабочий ревалидатор `revalidateSavedLecture` (живой потребитель — `saved-lecture-view.tsx` при открытии `/saved/{id}` онлайн). Добавляем токен свежести в запись бандла, ловим его при сохранении, и в ревалидации меняем полный probe на manifest-probe с условным запросом. Трейл-манифест и секционная ревалидация НЕ делаются (нет офлайн-дескриптора трейлов / механизма частичного ре-ассембла — YAGNI).

**Tech Stack:** Next.js 16, TypeScript strict, openapi-fetch, IndexedDB (idb), vitest, pnpm.

## Global Constraints

- pnpm. **Верификация каждой задачи (все три):** `pnpm typecheck`, `pnpm lint` (на затронутых файлах), `pnpm test <затронутые>` — зелёные. На старте Plan C проект полностью зелёный (typecheck 0, lint 0, build OK) — НЕ регрессировать.
- Git: НЕ `git stash/reset/checkout .//clean`; НЕ `git add -A`/`.` — только свои файлы по имени. Не трогать `src/api/schema.ts` и чужие незакоммиченные/untracked файлы. Не пушить.
- Комментарии по-русски; kebab-case. Каждая задача — зелёные тесты + отдельный коммит.
- **Совместимость**: поле `freshnessToken` — опциональное; старые сохранённые бандлы (без него) должны продолжать ревалидироваться по существующему `updated_at`-probe (фолбэк). Без бампа схемы IndexedDB.
- **Не делать (явный YAGNI):** trail-манифест (нет offline-дескриптора трейлов), секционное (`sections`/`members`) частичное обновление.

---

## Файловая структура

- Modify: `src/services/offline/contract/storage.ts` — поле `freshnessToken?: string` в `SavedBundleRecord`.
- Create: `src/app/_offline/probe-lecture-manifest-action.ts` — server action manifest-probe.
- Modify: `src/app/_offline/revalidate-saved-lecture.ts` — использовать manifest-probe при наличии токена (фолбэк на старый probe).
- Modify: `src/app/_offline/save-offline.ts` (или save-флоу) — захватывать `freshnessToken` при сохранении.
- Test: `src/app/_offline/probe-lecture-manifest-action.test.ts` (создать); расширить тест `revalidate-saved-lecture` (если есть).

---

### Task 1: Токен свежести + manifest-probe action

**Files:**
- Modify: `src/services/offline/contract/storage.ts`
- Create: `src/app/_offline/probe-lecture-manifest-action.ts`
- Test: `src/app/_offline/probe-lecture-manifest-action.test.ts` (создать)

**Interfaces:**
- Produces: `SavedBundleRecord.freshnessToken?: string`; `probeLectureManifest(id: string, token: string | undefined): Promise<ManifestProbe>` где `ManifestProbe = { status: "fresh" } | { status: "stale"; freshnessToken: string } | { status: "gone" } | { status: "skip" }`.

- [ ] **Step 1: Добавить поле в SavedBundleRecord**

В `src/services/offline/contract/storage.ts` в интерфейс `SavedBundleRecord` добавить опциональное поле (рядом с `remoteStatus`):

```typescript
  /** Корневой токен свежести (ETag манифеста) на момент сохранения/последней
   * ревалидации. Используется как If-None-Match для дешёвой проверки. */
  freshnessToken?: string;
```

(Бамп `OFFLINE_SCHEMA_VERSION` НЕ нужен — поле опциональное, добавляется через `updateSavedBundle`.)

- [ ] **Step 2: Написать падающий тест manifest-probe**

Создать `src/app/_offline/probe-lecture-manifest-action.test.ts`. Мокать `@/api/client` (createApiClient → объект с `GET`). Кейсы (GET возвращает `{ data, error, response }`, где `response` — объект с `status`, `ok`, `headers.get`):

```typescript
it("304 → fresh", async () => {
  get.mockResolvedValue({ data: undefined, error: "", response: { status: 304, ok: false, headers: { get: () => null } } });
  expect(await probeLectureManifest("L1", '"5"')).toEqual({ status: "fresh" });
});
it("404 → gone", async () => {
  get.mockResolvedValue({ data: undefined, error: {}, response: { status: 404, ok: false, headers: { get: () => null } } });
  expect(await probeLectureManifest("L1", '"5"')).toEqual({ status: "gone" });
});
it("200 → stale с новым токеном из ETag", async () => {
  get.mockResolvedValue({ data: { data: { version: "6" } }, error: undefined, response: { status: 200, ok: true, headers: { get: (h: string) => (h === "ETag" ? '"6"' : null) } } });
  expect(await probeLectureManifest("L1", '"5"')).toEqual({ status: "stale", freshnessToken: '"6"' });
});
it("ошибка сети → skip", async () => {
  get.mockRejectedValue(new Error("net"));
  expect(await probeLectureManifest("L1", undefined)).toEqual({ status: "skip" });
});
```

- [ ] **Step 3: Запустить — падает**

Run: `pnpm test src/app/_offline/probe-lecture-manifest-action.test.ts`
Expected: FAIL (модуль не существует).

- [ ] **Step 4: Реализовать probe action**

Создать `src/app/_offline/probe-lecture-manifest-action.ts` (мирроль `probe-lecture-action.ts`):

```typescript
"use server";
import "server-only";

import { createApiClient } from "@/api/client";

/** Результат лёгкой проверки свежести лекции через манифест. */
export type ManifestProbe =
  | { status: "fresh" }
  | { status: "stale"; freshnessToken: string }
  | { status: "gone" }
  | { status: "skip" };

/**
 * Дешёвая проверка свежести лекции: GET манифеста с If-None-Match.
 * 304 → не менялось (fresh). 200 → изменилось (stale + новый токен). 404 → gone.
 * Любая иная ошибка/отсутствие токена в ответе → skip (без вердикта).
 */
export async function probeLectureManifest(
  id: string,
  token: string | undefined,
): Promise<ManifestProbe> {
  try {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/manifest", {
      params: {
        path: { id },
        ...(token ? { header: { "If-None-Match": token } } : {}),
      },
    });
    // 304 — проверять ДО error: openapi-fetch кладёт не-2xx в error.
    if (response.status === 304) return { status: "fresh" };
    if (response.status === 404) return { status: "gone" };
    if (error || !response.ok) return { status: "skip" };
    const next = response.headers.get("ETag") ?? (data?.data?.version != null ? `"${data.data.version}"` : null);
    if (!next) return { status: "skip" };
    return { status: "stale", freshnessToken: next };
  } catch {
    return { status: "skip" };
  }
}
```

- [ ] **Step 5: Запустить — зелёный**

Run: `pnpm test src/app/_offline/probe-lecture-manifest-action.test.ts`
Expected: PASS (4 кейса).

- [ ] **Step 6: Верификация**

Run: `pnpm typecheck` — 0. `pnpm exec eslint src/services/offline/contract/storage.ts src/app/_offline/probe-lecture-manifest-action.ts src/app/_offline/probe-lecture-manifest-action.test.ts` — 0.

- [ ] **Step 7: Коммит**

```bash
git add src/services/offline/contract/storage.ts src/app/_offline/probe-lecture-manifest-action.ts src/app/_offline/probe-lecture-manifest-action.test.ts
git commit -m "feat(offline): manifest-probe лекции (If-None-Match) + freshnessToken в бандле"
```

---

### Task 2: Интеграция — захват токена при сохранении + manifest-ревалидация

**Files:**
- Modify: `src/app/_offline/save-offline.ts` (захват `freshnessToken` после сохранения)
- Modify: `src/app/_offline/revalidate-saved-lecture.ts` (manifest-probe при наличии токена, фолбэк на старый probe)
- Test: расширить/создать тесты для `revalidate-saved-lecture`

**Interfaces:**
- Consumes: `probeLectureManifest` (Task 1), `SavedBundleRecord.freshnessToken` (Task 1), `updateSavedBundle` (существующий).

- [ ] **Step 1: Захват freshnessToken при сохранении**

Прочитать `src/app/_offline/save-offline.ts`. После успешного `putSavedBundle` (бандл сохранён) добавить захват токена: вызвать `probeLectureManifest(id, undefined)` и, если `status === "stale"`, записать `freshnessToken` в запись через `updateSavedBundle("lectures", id, { freshnessToken })`. Захват best-effort — ошибка/skip не должны ломать сохранение (бандл уже сохранён). Это даёт ревалидации стартовый токен для последующего If-None-Match.

- [ ] **Step 2: Тест ревалидации (manifest-путь)**

Прочитать текущий `src/app/_offline/revalidate-saved-lecture.ts` и его тест (если есть). Добавить/создать тест: при наличии `rec.freshnessToken` ревалидация зовёт `probeLectureManifest` и:
- `fresh` → `"fresh"` (и НЕ зовёт legacy `probeLectureForOffline`);
- `stale` → `"stale"` + `updateSavedBundle` пишет новый `freshnessToken` и `remoteStatus: "stale"`;
- `gone` → `"gone"` (`remoteStatus: "gone"`);
- при ОТСУТСТВИИ `freshnessToken` (старый бандл) → фолбэк на существующий `probeLectureForOffline` (поведение не меняется).
Мокать `./probe-lecture-manifest-action`, `./probe-lecture-action`, `@/services/offline/store/saved-bundles`.

- [ ] **Step 3: Запустить — падает**

Run: `pnpm test src/app/_offline/revalidate-saved-lecture.test.ts`
Expected: FAIL (manifest-путь не реализован).

- [ ] **Step 4: Реализовать manifest-ветку в revalidateSavedLecture**

В `src/app/_offline/revalidate-saved-lecture.ts`: прочитать запись бандла; если `rec.freshnessToken` задан — использовать `probeLectureManifest(id, rec.freshnessToken)` и смаппить:
- `fresh` → вернуть `"fresh"` (опционально снять прежний `remoteStatus`);
- `stale` → `updateSavedBundle("lectures", id, { remoteStatus: "stale", freshnessToken })`, вернуть `"stale"`;
- `gone` → `updateSavedBundle("lectures", id, { remoteStatus: "gone" })`, вернуть `"gone"`;
- `skip` → фолбэк на существующую ветку `probeLectureForOffline`.
Если `freshnessToken` НЕТ — оставить полностью существующую логику (`probeLectureForOffline` + сравнение `updated_at`). Существующий контракт возврата (`"fresh"|"stale"|"gone"|"skip"`) и потребитель (`saved-lecture-view.tsx`) НЕ менять.

- [ ] **Step 5: Запустить — зелёный**

Run: `pnpm test src/app/_offline/revalidate-saved-lecture.test.ts`
Expected: PASS.

- [ ] **Step 6: Верификация**

Run: `pnpm typecheck` — 0. `pnpm exec eslint <изменённые>` — 0. `pnpm test src/app/_offline src/services/offline` — зелёное.

- [ ] **Step 7: Коммит**

```bash
git add src/app/_offline/save-offline.ts src/app/_offline/revalidate-saved-lecture.ts src/app/_offline/revalidate-saved-lecture.test.ts
git commit -m "feat(offline): ревалидация сохранённой лекции через freshness-манифест (304-fast-path)"
```

---

### Task 3: Гейт + ревью

- [ ] **Step 1: Полный гейт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: всё зелёное (0/0, тесты passed, build OK).

- [ ] **Step 2: Ревью**

Передать ревьюеру диф Plan C: корректность 304-обработки (до error), best-effort захвата токена (не ломает save), фолбэк для старых бандлов (без freshnessToken), отсутствие регрессии контракта `revalidateSavedLecture`, YAGNI-границы (нет trail-манифеста/секционного).

---

## Self-Review (автор плана)

**Спек-покрытие (секция 7 спеки — манифесты, read-side):** lecture manifest fetcher с If-None-Match→304 → Task 1; интеграция в живой ревалидатор + захват токена → Task 2. Трейл-манифест/секционное — явно вне scope (YAGNI, нет потребителя) — задокументировано. ✓

**Скан плейсхолдеров:** код probe-action и тесты приведены дословно; интеграционные шаги ссылаются на конкретные существующие файлы для чтения + дают точный маппинг статусов и фолбэк. ✓

**Согласованность типов:** `ManifestProbe` (Task 1) потребляется в Task 2; `freshnessToken?: string` единообразно (storage → save → revalidate); контракт `revalidateSavedLecture` (`"fresh"|"stale"|"gone"|"skip"`) сохранён. ✓

# Offline F1 — Service Worker для офлайн-чтения (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Доработать Service Worker так, чтобы сохранённые офлайн-картинки переживали обновление SW и отдавались по их безрасширенным `/static/files/{key}` URL, а раздел `/saved*` открывался офлайн (app-shell).

**Architecture:** Чистые решения маршрутизации/очистки кэшей выносятся в `src/services/offline/sw/sw-logic.ts` (юнит-тестируется vitest'ом) и **инлайнятся** в `public/sw.js` на этапе `build` (генератор транспилирует TS через `ts.transpileModule` и вставляет на место маркера в `src/sw.template.js`). Сам SW (handlers с `caches`/`fetch`) остаётся тонким и вызывает инлайненные предикаты. Источник истины для имени офлайн-бакета — `contract/storage.ts`; тест защищает от дрейфа.

**Tech Stack:** Service Worker API (Cache Storage), vanilla JS шаблон + плейсхолдеры, Node ESM build-скрипт (`typescript` для транспиляции), TypeScript 6 (strict), vitest 4.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Генерация SW (НЕ редактировать `public/sw.js` напрямую):**
- `public/sw.js` — **генерируемый артефакт**. Его собирает `scripts/generate-sw-assets.mjs` (вызывается из `package.json` → `"build": "node scripts/generate-sw-assets.mjs && next build"`), заменяя в `src/sw.template.js` плейсхолдеры `__BASE_PATH__` (→ `""`) и `__SW_VERSION__` (→ `Date.now().toString(36)`).
- Любая правка `public/sw.js` руками будет затёрта следующим build. **Все изменения SW делаем в `src/sw.template.js`**, затем регенерируем.
- В git сейчас висит незакоммиченная правка `public/sw.js` — это **только bump `SW_VERSION`** (артефакт чьего-то `pnpm build`), не WIP-фича. Регенерация её корректно вытеснит.

**Два бага seam'а, которые чиним:**
1. **`flbz-offline-images` стирается при каждом обновлении SW.** `activate`-cleanup (`src/sw.template.js:32-46`) удаляет любой кэш, начинающийся с `flbz` и не входящий в `ALL_CACHES`. Бакет офлайн-картинок `flbz-offline-images` (константа `OFFLINE_IMAGE_CACHE` в `src/services/offline/contract/storage.ts:7`) под это попадает → сохранённые офлайн-снимки теряют картинки при любом апдейте SW.
2. **Офлайн-картинки не отдаются по их URL.** `saveOffline` (`src/app/_offline/save-offline.ts:49`) кладёт картинки в `flbz-offline-images` под ключом `resolveStorageUrl(key)` = `/static/files/{key}` (same-origin, base пустой). Но SW-image-handler (`src/sw.template.js:74-77`) матчит только `\.(jpeg|jpg|png|webp)$` и читает другой бакет `flbz-images-${SW_VERSION}`. `/static/files/{key}` **без расширения** под regex не попадает → запрос уходит в default-ветку (`fetch(request).catch(() => caches.match(OFFLINE_URL))`) → офлайн возвращается HTML `offline.html` вместо картинки.

**Что подтверждено разведкой:**
- `cacheImage`/`matchCachedImage` (`src/services/offline/store/images.ts`) пишут/читают `flbz-offline-images` по полному URL; покрыты `images.test.ts` (FakeCache) — это кооперирующий контракт, его не трогаем.
- `/static/files/*` — **same-origin** (бэк: StorageType=local, CORS не нужен). SW-guard `url.origin !== self.location.origin` их НЕ отсекает.
- Маршрута `/saved` пока НЕТ (его создаёт будущий слайс L). App-shell-ветка для `/saved*` в F1 — **дормантна** (нулевой рантайм-эффект до появления маршрута), но forward-compatible.
- Хук регистрации `src/hooks/use-register-sw.ts` и `offline.html` не трогаем.

**Границы конфигов (важно для размещения файлов):**
- `pnpm lint` = `eslint src/` — линтит и `src/sw.template.js` (`.js`), поэтому ссылки на инлайненные символы защищаем директивой `/* global ... */`.
- `pnpm typecheck` = `tsc --noEmit` — `include` только `**/*.ts(x)`; `src/sw.template.js` и `public/sw.js` НЕ типизируются. `sw-logic.ts` (TS) — типизируется и линтится strictTypeChecked, пишем чисто.
- `pnpm test` = `vitest run`, include `src/**/*.test.{ts,tsx}` — тестит `sw-logic.test.ts`.
- `typescript@^6.0.3` в devDependencies → `import ts from "typescript"` в `.mjs` доступен.

**Testing strategy (почему так):** SW (`sw.template.js`/`public/sw.js`) исполняется в SW-контексте и не импортируется vitest'ом — как и в текущем проекте, сам SW юнит-тестами не покрыт. Поэтому вся тестируемая логика (очистка кэшей, классификация запросов) вынесена в чистый `sw-logic.ts` и покрыта юнит-тестами (Task 1). Инлайнинг в SW верифицируется детерминированно: прогон генератора + grep по `public/sw.js` + кооперирующие `images.test.ts` + `pnpm build` (запускает генератор). Тонкие SW-handlers (`offlineFileFirst`, `navigationNetworkFirst`) — это вариации существующих `cacheFirst`/`networkFirst`, проверяются grep'ом и сборкой.

**Out of scope (YAGNI):**
- Не меняем существующий extension-image handler (`cacheFirstWithLimit`) и его offline.html-фолбэк.
- Не прекэшируем конкретные `/saved/{id}` — это слайс L (см. downstream-контракты ниже).
- Не поддерживаем cross-origin CDN для `/static/files/*` (бэк подтвердил same-origin; если позже появится `NEXT_PUBLIC_STORAGE_URL` на другой origin — SW-guard `url.origin !== self.location.origin` отсечёт картинки, тогда seam пересматривается).
- Никакого Background Sync API — синк foreground (см. F3/F4).

**Downstream-контракты для слайса L:**
- `/saved/[id]` рендерить как **client-страницу** (client component читает снимок из IndexedDB), чтобы её закэшированный HTML-shell был переиспользуем независимо от `id`.
- `navigationNetworkFirst` кэширует `/saved*` per-URL при онлайн-визите; впервые-открытый офлайн `/saved/{id}` (не посещённый онлайн) отдаст `offline.html`. Слайс L при необходимости греет `SAVED_SHELL_CACHE` на первом онлайн-визите `/saved` или прекэширует shell при сохранении.
- **Ключ картинки — инвариант seam'а:** `lectureDescriptor.extractImageKeys` возвращает голые 64-hex `storage_key`, идентичные тем, что подставляются в `<img src>` через `resolveStorageUrl(key)` — БЕЗ суффиксов/derivative-вариантов/query. Иначе `offlineCache.match(request)` промахнётся (Cache Storage матчит по полному URL с query).
- **Рендер картинок в SavedLectureView — только native `<img src={resolveStorageUrl(key)}>`, НЕ `next/image`**, без query-параметров. (`images.unoptimized:true` сейчас это и обеспечивает, но контракт фиксируем явно — `next/image` переписал бы src в `/_next/image?url=…` и `isOfflineFileRequest` промахнулся бы.)
- При вводе реального `/saved` в слайсе L: вынести `SAVED_SHELL_CACHE` в общий контракт-модуль и добавить тест-сверку имени (по образцу сверки `OFFLINE_IMAGE_CACHE`), чтобы избежать дрейфа имени бакета.

**Известный pre-existing риск: basePath/scope — РЕШЕНО (пользователь, 2026-06-14).**
Прод раздаётся **в корне origin** (scope = `/`), поэтому SW контролирует `/static/files/*` и seam в проде корректен; `NEXT_PUBLIC_BASE_PATH=/philosophy` в `.env.production` — **стейл**. Действие: убедиться, что прод-билд НЕ выставляет `NEXT_PUBLIC_BASE_PATH` (иначе `use-register-sw.ts` зарегистрирует scope `/philosophy/` при корневом сайте и SW перестанет видеть запросы). Ниже — исходный анализ риска для истории.

В `.env.production` заданы `NEXT_PUBLIC_BASE_PATH=/philosophy` и base-URL под GitHub Pages, а `src/hooks/use-register-sw.ts` регистрирует SW со `scope: "${NEXT_PUBLIC_BASE_PATH}/"` (= `/philosophy/` в prod). При этом `next.config.ts` НЕ задаёт `basePath`/`output:'export'`, а `resolveStorageUrl` возвращает корне-относительный `/static/files/{key}` (обе `NEXT_PUBLIC_STORAGE_URL`/`NEXT_PUBLIC_API_URL` не заданы → base=""). Если prod реально живёт под `/philosophy/`, то (а) `<img src="/static/files/{key}">` уходит на origin-корень (без `/philosophy`), и (б) SW со scope `/philosophy/` такие запросы НЕ контролирует → `offlineFileFirst` (Task 3) в prod недостижим, а `isSavedShellNavigation("/saved")` не сматчит `/philosophy/saved`. Рассинхрон **предсуществует** (генератор и сейчас хардкодит `__BASE_PATH__=''`) и касается всего SW, не только F1; F1 корректен для same-origin base="" (dev и single-origin self-host). **Решение нужно ДО prod-релиза офлайна, не до реализации F1** (фича ещё не зашипана — слайсы L/A не готовы). Перед релизом: эмпирически снять реальный prod-`src` картинки и реальный scope SW, затем привести `resolveStorageUrl`/scope/предикаты в согласие (base-aware либо подтвердить single-origin). Открытый вопрос к топологии деплоя — см. сводку ревью.

---

## Файловая структура

- **Create:** `src/services/offline/sw/sw-logic.ts` — чистые предикаты + константы имён кэшей (инлайнится в SW).
- **Create:** `src/services/offline/sw/sw-logic.test.ts` — юнит-тесты + сверка с `contract/storage.ts`.
- **Modify:** `scripts/generate-sw-assets.mjs` — транспиляция+инлайн `sw-logic.ts` в SW.
- **Modify:** `src/sw.template.js` — `/* global */`-директива, маркер `//__SW_LOGIC__`, новая activate-очистка, две fetch-ветки (`/static/files/*`, `/saved*`), два handler'а.
- **Regenerate (commit as artifact):** `public/sw.js`.

---

## Task 1: Чистый модуль SW-логики + юнит-тесты

**Files:**
- Create: `src/services/offline/sw/sw-logic.ts`
- Test: `src/services/offline/sw/sw-logic.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `src/services/offline/sw/sw-logic.test.ts`:

```ts
// src/services/offline/sw/sw-logic.test.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import { OFFLINE_IMAGE_CACHE as STORAGE_OFFLINE_IMAGE_CACHE } from "../contract/storage";

import {
  OFFLINE_IMAGE_CACHE,
  SAVED_SHELL_CACHE,
  PRESERVED_CACHES,
  selectCachesToDelete,
  isOfflineFileRequest,
  isSavedShellNavigation,
} from "./sw-logic";

describe("sw-logic: имена кэшей", () => {
  it("OFFLINE_IMAGE_CACHE совпадает с источником истины contract/storage.ts (защита от дрейфа)", () => {
    expect(OFFLINE_IMAGE_CACHE).toBe(STORAGE_OFFLINE_IMAGE_CACHE);
  });

  it("preserved-набор включает офлайн-бакет картинок и shell", () => {
    expect(PRESERVED_CACHES).toContain(OFFLINE_IMAGE_CACHE);
    expect(PRESERVED_CACHES).toContain(SAVED_SHELL_CACHE);
  });
});

describe("sw-logic: инлайн-инвариант", () => {
  it("sw-logic.ts не содержит top-level import (генератор срезает import-строки → висячая ссылка = ReferenceError в SW, который node --check не ловит)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./sw-logic.ts", import.meta.url)),
      "utf-8",
    );
    expect(/^\s*import\b/m.test(src)).toBe(false);
  });
});

describe("selectCachesToDelete", () => {
  const active = ["flbz-static-v2", "flbz-next-v2", "flbz-api-v2", "flbz-images-v2"];

  it("удаляет устаревшие версионированные flbz-кэши", () => {
    const existing = [...active, "flbz-static-v1", "flbz-images-v1"];
    expect(selectCachesToDelete(existing, active)).toEqual([
      "flbz-static-v1",
      "flbz-images-v1",
    ]);
  });

  it("НЕ удаляет офлайн-бакет картинок (переживает обновление SW)", () => {
    const existing = [...active, OFFLINE_IMAGE_CACHE];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("НЕ удаляет shell-кэш", () => {
    const existing = [...active, SAVED_SHELL_CACHE];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("не трогает чужие кэши без префикса flbz", () => {
    const existing = [...active, "workbox-precache", "other-cache"];
    expect(selectCachesToDelete(existing, active)).toEqual([]);
  });

  it("сохраняет активный набор", () => {
    expect(selectCachesToDelete(active, active)).toEqual([]);
  });
});

describe("isOfflineFileRequest", () => {
  it("матчит /static/files/{key} (без расширения)", () => {
    expect(isOfflineFileRequest("/static/files/abc123")).toBe(true);
  });
  it("не матчит /_next/static/...", () => {
    expect(isOfflineFileRequest("/_next/static/chunk.js")).toBe(false);
  });
  it("не матчит произвольный путь", () => {
    expect(isOfflineFileRequest("/lectures/1")).toBe(false);
  });
});

describe("isSavedShellNavigation", () => {
  it("матчит navigate на /saved", () => {
    expect(isSavedShellNavigation("navigate", "/saved")).toBe(true);
  });
  it("матчит navigate на /saved/{id}", () => {
    expect(isSavedShellNavigation("navigate", "/saved/lectures:1")).toBe(true);
  });
  it("НЕ матчит не-navigate (напр. cors-fetch) на /saved", () => {
    expect(isSavedShellNavigation("cors", "/saved")).toBe(false);
  });
  it("НЕ матчит navigate на другой путь", () => {
    expect(isSavedShellNavigation("navigate", "/lectures/1")).toBe(false);
  });
  it("не матчит /savedxyz (граница сегмента)", () => {
    expect(isSavedShellNavigation("navigate", "/savedxyz")).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `pnpm exec vitest run src/services/offline/sw/sw-logic.test.ts`
Expected: FAIL — `Failed to resolve import "./sw-logic"` (модуль ещё не создан).

- [ ] **Step 3: Реализовать `sw-logic.ts`**

Создать `src/services/offline/sw/sw-logic.ts`:

```ts
// src/services/offline/sw/sw-logic.ts
// Чистые (без SW-глобалов и без import) решения маршрутизации и очистки кэшей
// для Service Worker. ИНЛАЙНИТСЯ в public/sw.js на этапе build: генератор
// (scripts/generate-sw-assets.mjs) транспилирует этот файл через ts.transpileModule,
// срезает import/export и вставляет на место маркера SW-логики в src/sw.template.js.
// Поэтому ЗДЕСЬ ЗАПРЕЩЕНЫ: import'ы, SW-глобалы (self/caches/fetch), enum, template-imports.
// ВАЖНО: имена объявляемых здесь const НЕ должны совпадать с константами шаблона
// (там уже есть CACHE_PREFIX/IMAGE_CACHE/…) — иначе двойной `const` в собранном SW =
// SyntaxError, и SW не зарегистрируется. Поэтому локальный префикс назван FLBZ_PREFIX.
// Только чистые функции и строковые константы. Покрыто sw-logic.test.ts (вкл. сверку
// OFFLINE_IMAGE_CACHE с contract/storage.ts и запрет top-level import).

const FLBZ_PREFIX = "flbz";

/** Неверсионируемый бакет Cache Storage для офлайн-картинок (= contract/storage.ts OFFLINE_IMAGE_CACHE). */
export const OFFLINE_IMAGE_CACHE = "flbz-offline-images";

/** Неверсионируемый бакет app-shell офлайн-раздела /saved. */
export const SAVED_SHELL_CACHE = "flbz-shell";

/** Кэши, которые activate-cleanup НЕ должен удалять (живут под persist(), не версионируются). */
export const PRESERVED_CACHES: string[] = [OFFLINE_IMAGE_CACHE, SAVED_SHELL_CACHE];

/**
 * Какие существующие кэши удалить при активации нового SW: только наши (`flbz-*`),
 * не входящие в активный версионированный набор и не из preserved-набора.
 */
export function selectCachesToDelete(
  existing: string[],
  active: string[],
  preserved: string[] = PRESERVED_CACHES,
): string[] {
  return existing.filter(
    (name) =>
      name.startsWith(FLBZ_PREFIX) &&
      !active.includes(name) &&
      !preserved.includes(name),
  );
}

/** Запрос к сохранённому офлайн-файлу (content-addressed, без расширения): /static/files/{key}. */
export function isOfflineFileRequest(pathname: string): boolean {
  return pathname.startsWith("/static/files/");
}

/**
 * Навигация (hard-load документа) в офлайн-раздел /saved (app-shell).
 * BASE_PATH в этом деплое = "" (см. generate-sw-assets.mjs), поэтому проверяем
 * абсолютный префикс пути. Клиентские RSC-fetch'и имеют mode !== "navigate" и сюда не попадают.
 */
export function isSavedShellNavigation(mode: string, pathname: string): boolean {
  return (
    mode === "navigate" &&
    (pathname === "/saved" || pathname.startsWith("/saved/"))
  );
}
```

- [ ] **Step 4: Прогнать тест — убедиться, что зелёный**

Run: `pnpm exec vitest run src/services/offline/sw/sw-logic.test.ts`
Expected: PASS (все describe-блоки зелёные).

- [ ] **Step 5: Коммит**

```bash
git add src/services/offline/sw/sw-logic.ts src/services/offline/sw/sw-logic.test.ts
git commit -m "feat(offline/sw): pure cache-routing logic for service worker (F1 task 1)"
```

---

## Task 2: Инлайн SW-логики на build + починка activate-cleanup

Здесь генератор начинает инлайнить `sw-logic.ts`, а `activate` становится первым потребителем `selectCachesToDelete` — это доказывает работоспособность инлайнинга end-to-end и чинит баг №1 (стирание `flbz-offline-images`).

**Files:**
- Modify: `scripts/generate-sw-assets.mjs`
- Modify: `src/sw.template.js` (директива `/* global */`, маркер, новая activate-очистка)
- Regenerate: `public/sw.js`

- [ ] **Step 1: Расширить генератор — транспиляция + инлайн**

Заменить содержимое `scripts/generate-sw-assets.mjs` целиком на:

```js
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const version = Date.now().toString(36);

// Инлайним чистую SW-логику из единого TS-источника (покрыт юнит-тестами).
// Транспилируем в JS и срезаем import/export — в SW нет модульной системы.
const logicTs = readFileSync(
  resolve(root, 'src/services/offline/sw/sw-logic.ts'),
  'utf-8',
);
const logicJs = ts
  .transpileModule(logicTs, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
    },
  })
  .outputText;
const inlinedLogic = logicJs
  .replace(/^\s*import[^\n]*\r?\n/gm, '')
  .replace(/^export /gm, '');

// Generate sw.js (replace-функцией, чтобы $-последовательности в коде не интерпретировались)
const swTemplate = readFileSync(resolve(root, 'src/sw.template.js'), 'utf-8');
const sw = swTemplate
  .replace('//__SW_LOGIC__', () => inlinedLogic)
  .replaceAll('__BASE_PATH__', '')
  .replaceAll('__SW_VERSION__', version);
writeFileSync(resolve(root, 'public/sw.js'), sw);

// Generate manifest.webmanifest
const manifestTemplate = readFileSync(resolve(root, 'src/manifest.template.json'), 'utf-8');
writeFileSync(resolve(root, 'public/manifest.webmanifest'), manifestTemplate);

console.log(`[generate-sw-assets] version="${version}"`);
```

- [ ] **Step 2: Добавить `/* global */`-директиву и маркер инлайна в шаблон**

В `src/sw.template.js` **вставить первой строкой файла** (перед `const BASE_PATH`):

```js
/* global selectCachesToDelete, isOfflineFileRequest, isSavedShellNavigation, OFFLINE_IMAGE_CACHE, SAVED_SHELL_CACHE, PRESERVED_CACHES */
```

Затем после строки `const IMAGE_CACHE_LIMIT = 100;` (сейчас строка 20) добавить пустую строку и блок-маркер:

```js

// Чистая маршрутизация/очистка кэшей инлайнится из src/services/offline/sw/sw-logic.ts
// на этапе build (scripts/generate-sw-assets.mjs). Здесь НЕ редактировать.
//__SW_LOGIC__
```

- [ ] **Step 3: Заменить activate-cleanup на `selectCachesToDelete`**

В `src/sw.template.js` заменить обработчик `activate` (сейчас строки 32-46):

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((e) => console.error('[SW] activate error:', e))
  );
});
```

на:

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          selectCachesToDelete(keys, ALL_CACHES).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((e) => console.error('[SW] activate error:', e))
  );
});
```

- [ ] **Step 4: Регенерировать SW и проверить инлайн**

Run: `node scripts/generate-sw-assets.mjs`
Expected: вывод `[generate-sw-assets] version="..."`, без ошибок.

**Главная проверка — синтаксическая валидность собранного SW** (ловит двойные `const`, висячие import/export, любую поломку инлайна; grep по тексту этого НЕ ловит, поэтому это обязательный шаг):

```bash
node --check public/sw.js   # exit 0, без вывода. Любой SyntaxError = инлайн/шаблон сломан.
```

Если `node --check` упал с `Identifier '...' has already been declared` — это коллизия имени между шаблоном и `sw-logic.ts` (напр. `CACHE_PREFIX`); переименовать в `sw-logic.ts` до exit 0.

Дополнительные текстовые проверки (каждая печатает число — ожидаемое указано):

```bash
grep -c "function selectCachesToDelete" public/sw.js   # 1
grep -c "flbz-offline-images" public/sw.js              # >=1
grep -c "__SW_LOGIC__" public/sw.js                     # 0  (маркер заменён инлайном; в комментариях sw-logic.ts литерала маркера быть не должно)
grep -cE "^export " public/sw.js                        # 0
grep -cE "^import " public/sw.js                        # 0
```

- [ ] **Step 5: Прогнать lint + тесты SW-логики**

Run: `pnpm lint && pnpm exec vitest run src/services/offline/sw/sw-logic.test.ts`
Expected: lint 0 ошибок (для `.js` no-undef в текущем конфиге де-факто выключен; директива `/* global */` — forward-compat, НЕ несущая защита), тесты PASS.

- [ ] **Step 6: Коммит**

```bash
git add scripts/generate-sw-assets.mjs src/sw.template.js public/sw.js
git commit -m "feat(offline/sw): inline sw-logic at build, preserve offline caches on activate (F1 task 2)"
```

---

## Task 3: Отдавать `/static/files/*` из офлайн-бакета (починка seam'а картинок)

Баг №2: SW не маршрутизирует безрасширенные `/static/files/{key}` в `flbz-offline-images`.

**Files:**
- Modify: `src/sw.template.js` (новая fetch-ветка + handler `offlineFileFirst`)
- Regenerate: `public/sw.js`

- [ ] **Step 1: Добавить fetch-ветку `/static/files/*`**

В `src/sw.template.js`, в обработчике `fetch`, **сразу после** блока API-ветки:

```js
  // API requests — network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }
```

добавить:

```js
  // Сохранённые офлайн-файлы (content-addressed, без расширения) — из офлайн-бакета.
  if (isOfflineFileRequest(url.pathname)) {
    event.respondWith(offlineFileFirst(request));
    return;
  }
```

- [ ] **Step 2: Добавить handler `offlineFileFirst`**

В `src/sw.template.js`, рядом с прочими handler'ами (после функции `trimCache`), добавить:

```js
async function offlineFileFirst(request) {
  const offlineCache = await caches.open(OFFLINE_IMAGE_CACHE);
  const saved = await offlineCache.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const lru = await caches.open(IMAGE_CACHE);
      lru.put(request, response.clone());
      trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
    }
    return response;
  } catch {
    // Для картинки возвращаем 504, а не offline.html (HTML в <img> бессмыслен).
    return new Response(null, { status: 504, statusText: 'Offline' });
  }
}
```

- [ ] **Step 3: Регенерировать и проверить**

Run: `node scripts/generate-sw-assets.mjs && node --check public/sw.js`
Expected: генерация успешна, `node --check` — exit 0 без вывода.

```bash
grep -c "isOfflineFileRequest(url.pathname)" public/sw.js   # 1
grep -c "function offlineFileFirst" public/sw.js            # 1
grep -c "__SW_LOGIC__" public/sw.js                         # 0
```

- [ ] **Step 4: Прогнать кооперирующие тесты + lint**

Кооперирующий контракт (cacheImage пишет в тот же бакет, что читает SW) уже покрыт `images.test.ts`:

Run: `pnpm exec vitest run src/services/offline/store/images.test.ts && pnpm lint`
Expected: PASS, lint 0.

- [ ] **Step 5: Коммит**

```bash
git add src/sw.template.js public/sw.js
git commit -m "feat(offline/sw): serve /static/files/* from offline bundle cache (F1 task 3)"
```

---

## Task 4: App-shell для `/saved*` (forward-compatible)

Дормантная (до появления маршрута `/saved` в слайсе L) network-first навигация в сохраняемый shell-кэш. `SAVED_SHELL_CACHE` уже в `PRESERVED_CACHES` (Task 1), поэтому очистка его не трогает.

**Files:**
- Modify: `src/sw.template.js` (fetch-ветка `/saved*` + handler `navigationNetworkFirst`)
- Regenerate: `public/sw.js`

- [ ] **Step 1: Добавить навигационную ветку**

В `src/sw.template.js`, в обработчике `fetch`, **сразу после** guard'а `if (url.origin !== self.location.origin) return;` и **до** API-ветки:

```js
  // Навигация в офлайн-раздел /saved — network-first в сохраняемый shell-кэш (app-shell).
  // RSC-fetch'и (mode !== 'navigate') сюда не попадают — клиентскую навигацию не ломаем.
  if (isSavedShellNavigation(request.mode, url.pathname)) {
    event.respondWith(navigationNetworkFirst(request, SAVED_SHELL_CACHE));
    return;
  }
```

- [ ] **Step 2: Добавить handler `navigationNetworkFirst`**

В `src/sw.template.js`, рядом с прочими handler'ами (после `offlineFileFirst`), добавить:

```js
async function navigationNetworkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Не кэшируем редиректы (redirected Response в навигации может бросить в respondWith).
    if (response && response.status === 200 && !response.redirected) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}
```

- [ ] **Step 3: Регенерировать и проверить**

Run: `node scripts/generate-sw-assets.mjs && node --check public/sw.js`
Expected: генерация успешна, `node --check` — exit 0 без вывода.

```bash
grep -c "isSavedShellNavigation(request.mode, url.pathname)" public/sw.js   # 1
grep -c "function navigationNetworkFirst" public/sw.js                      # 1
grep -c "__SW_LOGIC__" public/sw.js                                         # 0
```

- [ ] **Step 4: Коммит**

```bash
git add src/sw.template.js public/sw.js
git commit -m "feat(offline/sw): network-first app-shell for /saved navigations (F1 task 4)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогнать весь гейт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && node --check public/sw.js`
Expected:
- `lint` — 0 ошибок.
- `typecheck` — 0 ошибок.
- `test` — все тесты зелёные (включая новый `sw-logic.test.ts`; +~18 тестов).
- `build` — `[generate-sw-assets] version="..."` затем успешная сборка Next (генератор отрабатывает без ошибок инлайна).
- `node --check public/sw.js` — exit 0 (собранный SW синтаксически валиден).

- [ ] **Step 2: Зафиксировать регенерацию (если build обновил public/sw.js)**

`pnpm build` перегенерирует `public/sw.js` с новым `SW_VERSION`. Если git показывает изменение:

```bash
git add public/sw.js
git commit -m "chore(offline/sw): regenerate sw.js (F1)"
```

---

## Self-Review (заполняется автором плана)

**Покрытие требований F1:**
- «cache `/static/files/*`» → Task 3 (`offlineFileFirst` + ветка `isOfflineFileRequest`).
- «app-shell `/saved*`» → Task 4 (`navigationNetworkFirst` + `isSavedShellNavigation`).
- «развязать bucket-seam» → Task 2 (activate сохраняет `flbz-offline-images`) + Task 3 (SW читает именно `OFFLINE_IMAGE_CACHE`, сверка имени тестом в Task 1).

**Тип-консистентность:** имена символов едины во всех задачах — `selectCachesToDelete`, `isOfflineFileRequest`, `isSavedShellNavigation`, `OFFLINE_IMAGE_CACHE`, `SAVED_SHELL_CACHE`, `PRESERVED_CACHES`, `offlineFileFirst`, `navigationNetworkFirst`. Директива `/* global */` (Task 2) перечисляет ровно инлайненные символы, используемые в шаблоне.

**Плейсхолдеры:** нет — весь код приведён дословно, команды с ожидаемым выводом.

**Риски/допущения:** (1) `eslint src/` на `sw.template.js` — `/* global */` нейтрализует возможный `no-undef`; если no-undef и так выключен, директива безвредна. (2) `ts.transpileModule` со стрипом `import/export` корректен только если `sw-logic.ts` без import'ов и без template-зависимостей (зафиксировано в шапке файла). (3) Регенерация `public/sw.js` каждый build меняет `SW_VERSION` — это существующее поведение, файл трекается и коммитится.

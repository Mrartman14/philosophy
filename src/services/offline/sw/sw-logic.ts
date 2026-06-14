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

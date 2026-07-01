// ЕДИНЫЙ container-детект wide-гейта движка маргиналий. Колонка карточек
// (margin-notes-column), выноски (connector-layer) и хук useWide (use-wide.ts,
// гейт слайсов inline-vs-rail) ОБЯЗАНЫ включаться синхронно с CSS-раскрытием полей,
// иначе rail рисует карточки там, где полей нет (наезд/overflow).
//
// Раскрытие полей живёт в CSS как `@container page-shell (min-width: 80em)`
// (layout.css §13): `em` в контейнер-квери резолвится от ВЫЧИСЛЕННОГО (уже
// масштабированного `--text-scale`) font-size контейнера `.page-shell` → порог
// scale-инвариантен. Прежний viewport-`matchMedia("(min-width: 80rem)")` дрейфовал
// от него при не-дефолтном `--text-scale`: 80rem всегда 1280px, а 80em = 1280px при
// scale 1, ~1600px при 1.25 → JS-гейт rail флипался НЕ в такт с CSS-полями (находка
// «80em-выравнивание»). Теперь JS зеркалит тот же контейнер-порог.
//
// Порог токенизирован (`--container-marginalia: 80em`, tokens.generated.css) —
// layout.css завёл токен ИМЕННО для JS-тулинга; читаем его из ОДНОГО источника, 80
// не дублируем.
export const PAGE_SHELL_SELECTOR = ".page-shell";

const MARGINALIA_THRESHOLD_TOKEN = "--container-marginalia";

/**
 * Открыты ли поля-маргиналии: inline-size контейнера `.page-shell` ≥ порог(em) ×
 * font-size контейнера — прямое зеркало CSS `@container page-shell (min-width: 80em)`.
 * `.page-shell` без горизонтального паддинга → `clientWidth` == content-box inline-
 * size (ровно то, что квери-ит `container-type: inline-size`), сверка точная.
 * SSR / jsdom / нет `.page-shell` / нечитаемый токен → false (рисуем inline-фолбэк).
 */
export function isMarginaliaWide(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (typeof window.getComputedStyle !== "function") return false;
  const shell = document.querySelector<HTMLElement>(PAGE_SHELL_SELECTOR);
  if (!shell) return false;
  const cs = window.getComputedStyle(shell);
  const fontSize = parseFloat(cs.fontSize);
  const thresholdEm = parseFloat(cs.getPropertyValue(MARGINALIA_THRESHOLD_TOKEN));
  if (!Number.isFinite(fontSize) || !Number.isFinite(thresholdEm)) return false;
  return shell.clientWidth >= thresholdEm * fontSize;
}

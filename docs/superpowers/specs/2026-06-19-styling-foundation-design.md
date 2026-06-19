# Дизайн: фундамент стилизации (design-token + theming foundation)

- **Дата:** 2026-06-19
- **Статус:** одобрен к написанию плана (brainstorming → writing-plans)
- **Тип:** foundation-update (затрагивает запретные зоны — отдельный координированный PR)

## 1. Контекст и цель

Заложить прочный, строгий, но гибкий и расширяемый фундамент стилизации проекта, не оглядываясь на текущую реализацию, и затем наложить его на существующий код. Два сквозных требования:

1. **Палитра, корректная по APCA** (перцептивный контраст), с автоматическим контролем.
2. **Глобальные настройки внешнего вида в аккаунте пользователя** — тема, размер текста, плотность+контраст, семейство шрифта.

Текущее состояние (база для наложения):

- Стек: **Next.js 16.1.4 + React 19.2.3**, **Tailwind v4 (CSS-first, `@theme` в `globals.css`, без `tailwind.config.js`)**, **Base UI** (`@base-ui/react`), шрифты через `next/font` (Geist/Geist Mono), Zod 4, vitest. Пакетный менеджер — **pnpm**.
- Палитра в `src/styles/themes/rebus.css` (микс OKLCH + hex), тёмная тема только через `@media (prefers-color-scheme: dark)` — пользовательского переключателя нет.
- `cn()` — простой join без merge (`src/components/ui/cn.ts`); есть `FOCUS_RING_*`, `SHELL_BASE`.
- Слайс `preferences` (пока только `reading_mode`), страница `/me/settings` — точка для настроек уже есть.
- `@tailwindcss/typography` (`prose`) используется в ~21 файле.

## 2. Зафиксированные решения

| Вопрос | Решение |
| --- | --- |
| Настраиваемые оси | Тема (светлая/тёмная/системная), размер текста, плотность+контраст, семейство шрифта |
| Хранение настроек | **Гибрид:** cookie (SSR, no-FOUC) + бэк-синк через `preferences` |
| Контраст | **APCA-native** + автоматический **CI-гард** на пары токенов |
| Эстетика | Сохранить тёплый бежевый вайб, **пере-вывести палитру формулой** под APCA |
| Источник истины токенов | **Вариант A:** типизированный TS-модуль → генерация CSS; `apcach`-деривация в TS; CI-гард импортит тот же модуль |
| Семейства шрифтов | sans (Geist) + **Atkinson Hyperlegible** (высоко-разборчивый/«доступный») + serif для чтения |
| Брейкпоинты | **px** (а не rem) — стабильный лейаут при масштабировании текста |
| Ритм `.content` | **Чистый flow** (односторонний `margin-block-start` через `--flow-space`, token-driven) |

## 3. Исследовательская база (ключевое, с источниками)

Два прохода deep-research, верифицировано первичными источниками (Myndex/APCA, W3C DTCG, Tailwind v4 docs, Next.js docs, MDN, рецензируемые исследования по шрифтам).

**APCA**
- Полярно-зависим и **несимметричен** — контраст считается для каждой пары fg/bg отдельно. Светлый фон → **положительные Lc**. ([APCA easy intro](https://git.apcacontrast.com/documentation/APCAeasyIntro.html), [Myndex/apca-w3](https://github.com/Myndex/apca-w3))
- Lc-таргеты (Bronze Simple Mode): **Lc 90** preferred / **75** min для body; **60** — вторичный текст; **45** — крупные заголовки; **30** — минимум для placeholder/disabled; **15** — нетекстовые/UI. ([APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html), [readtech.org/ARC](https://www.readtech.org/ARC/))
- **Не нормативен** (убран из черновика WCAG 3 в 2023; WCAG 2.2 — операционный стандарт). Используем как внутреннюю планку; WCAG 2.x AA — «пол» через `bridge-pca` при необходимости. ([readtech.org/ARC](https://www.readtech.org/ARC/), [w3c/wcag3#29](https://github.com/w3c/wcag3/issues/29))
- Деривация рампы: **`apcach`** (Evil Martians) — `apcach(crToBg(bg, Lc), chroma, hue, {searchDirection})` решает lightness в OKLCH. ([antiflasher/apcach](https://github.com/antiflasher/apcach))
- Вычисление/проверка: **`apca-w3`** v0.1.9 (`APCAcontrast(textY, bgY)`), константы заморожены на 0.0.98G-4g. ([Myndex/apca-w3](https://github.com/Myndex/apca-w3))

**Токены / Tailwind v4**
- DTCG-спека стабильна (2025.10) с нативным OKLCH — формат-ориентир, даже без полного пайплайна. ([DTCG announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/))
- Tailwind v4 отдаёт все токены `@theme` как CSS-переменные на `:root` → база для рантайм-переключения через `[data-*]`. **Gotcha (v4.0.5+):** неиспользуемые переменные tree-shake'атся — переключаемые объявлять `@theme inline`/`@theme static`. ([Tailwind v4 blog](https://tailwindcss.com/blog/tailwindcss-v4), [theming discussion #18471](https://github.com/tailwindlabs/tailwindcss/discussions/18471))

**No-FOUC / Next.js**
- `next-themes` **не подходит**: читает localStorage на клиенте (не сервер), `useTheme` undefined до маунта, требует `suppressHydrationWarning`, **один провайдер = одна ось** (вложенные провайдеры заблокированы). ([pacocoursey/next-themes](https://github.com/pacocoursey/next-themes))
- Правильный паттерн: cookie читается в root layout (server) → `data-*` + `color-scheme` на `<html>` до пейнта → 0 hydration mismatch. Гибрид: бэк авторитетен, cookie — быстрый SSR-кеш; write-through при изменении, реконсиляция при логине.

**Шрифты**
- Своп семейства: все шрифты `next/font` = свои CSS-переменные на `<html>`, активный — переназначением `--app-font` через `[data-font]`. Без ре-загрузки. ([Next.js Font docs](https://nextjs.org/docs/app/api-reference/components/font))
- CLS гасят метрик-матч fallback'и (`adjustFontFallback` + 4 `@font-face`-дескриптора). ⚠️ Известны баг-репорты, что `adjustFontFallback` для Google-шрифтов игнорируется в рантайме — CLS мерить эмпирически. ([Chrome blog](https://developer.chrome.com/blog/framework-tools-font-fallback/))
- **Дислексия-шрифты:** рецензируемые исследования против бесполезности/вреда OpenDyslexic (Wery & Diliberto 2017 — [PMC5629233](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5629233/); Rello & Baeza-Yates 2016 — [ACM 10.1145/2897736](https://dl.acm.org/doi/10.1145/2897736)). Помогают обычные высоко-разборчивые sans-serif. Вывод: предлагаем sans + Atkinson Hyperlegible + serif; OpenDyslexic — не закладываем (можно opt-in позже без обещаний эффекта).

**Плотность / контраст**
- Единого «множителя» нет: Material — формула высоты компонента; Atlassian/Carbon — базовая spacing-шкала + выбор шага. Берём гибрид: фиксированная spacing-шкала + узкий набор density-aware semantic-токенов. ([Material density](https://medium.com/google-design/using-material-density-on-the-web-59d85f1918f0), [Atlassian spacing](https://atlassian.design/foundations/spacing), [Carbon spacing](https://carbondesignsystem.com/elements/spacing/overview/))
- `forced-colors: active` перебивает авторские цвета вне каскада — **уступаем ОС**, только точечные правки; `prefers-contrast: more` — дефолт-триггер high-режима. ([MDN forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors), [CSS Color Adjust L1](https://www.w3.org/TR/css-color-adjust-1/))

## 4. Архитектура

Четыре независимые оси внешнего вида выражаются как `data-*`-атрибуты + одна inline-переменная на `<html>`. Значения приходят из cookie, прочитанной на сервере в root layout → **0 FOUC, 0 hydration mismatch**. Стили — трёхъярусные токены с единственным источником истины в TS-модуле, из которого генерируется CSS и который же кормит APCA-CI-гард.

### 4.1 Ярусы токенов

- **Tier 1 — Primitive** (`primitives.ts`): сырые OKLCH-рампы (тёплый нейтральный «sand», акцент, link-blue, danger/success/warning/info) + не-цветовые шкалы (spacing 4px-база, type-scale, radius, shadow, z-index, duration, font-families). Рампы выкладываются на lightness'ах, вычисленных `apcach` под Lc-сетку против канонических фонов.
- **Tier 2 — Semantic** (`semantic.ts`): переключаемый ярус.
  - Цвет: `--color-bg / bg-subtle / bg-raised / bg-overlay`; `--color-fg / fg-muted / fg-subtle / fg-on-accent`; `--color-border / border-strong / ring`; `--color-accent / accent-hover / accent-fg`; `--color-link / link-hover`; статусы `danger/success/warning/info` (+ `-bg`, `-fg`).
  - Не-цвет: `--space-*`, `--size-control-h-{sm,md,lg}`, `--space-control-pad-{x,y}`, `--space-stack`, `--text-*`, `--font-ui`, `--radius-*`, `--shadow-*`, `--z-*`, `--duration-*`.
- **Tier 3 — Component** (тонкий, по необходимости): `--button-*`, `--input-*` и т.п. — только где компоненту нужна своя ручка. Минимизируем.

### 4.2 Оси и `data`-атрибуты на `<html>`

| Ось | Механизм | Значения |
| --- | --- | --- |
| Тема | `data-theme` (только при явном выборе; «system» → без атрибута, работает media-query) + `color-scheme` | `light` / `dark` |
| Контраст | `data-contrast` + дефолт-триггер `@media (prefers-contrast: more)` | `normal` (по умолчанию) / `high` |
| Плотность | `data-density` | `comfortable` (по умолчанию) / `compact` |
| Шрифт | `data-font` → `--app-font` | `sans` / `legible` / `serif` |
| Размер текста | inline `style="--text-scale: n"` | `0.9 / 1 / 1.125 / 1.25` |

### 4.3 Композиция без комбинаторного взрыва

Каждая ось перекрывает **непересекающееся** подмножество semantic-токенов: тема+контраст → только цвет; плотность → только spacing/size; размер → только type (через `--text-scale`); шрифт → только `--app-font`. Реально взаимодействуют лишь тема×контраст (обе про цвет) → **4 цветовых слоя**. Остальное складывается простым каскадом.

## 5. Палитра под APCA (сохраняя бежевый вайб)

- Полярность: светлый фон → положительные Lc; тёмная тема — отдельный вывод (свои пары).
- Lc-таргеты по семантике (см. §3): body `--color-fg` → Lc 90 (min 75), `--color-fg-muted` → 60, заголовки → 45+, `--color-fg-subtle`/disabled → 30–45, `--color-border` → 15+, интерактивные `border-strong`/`ring` — выше.
- Деривация: `apcach(crToBg(bg, targetLc), chroma, hue, {searchDirection})` фиксирует тёплый hue/chroma бежевого, решает lightness → вайб сохраняется, контраст корректен. Рампы и semantic-маппинги задаются в TS; конкретные OKLCH-значения вычисляются при генерации.
- WCAG 2.x AA — отдельная неблокирующая проверка через `bridge-pca` (на случай формальной сертификации).

## 6. Механизм темизации (Tailwind v4)

Сырые значения — plain-CSS-переменные в `:root` и слоях-оверрайдах; Tailwind-токены маппятся на них через `@theme inline`, чтобы utility-классы ссылались на рантайм-переменную (а не на замороженную копию):

```css
/* tokens.generated.css — генерируется */
@theme inline {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --font-ui:  var(--app-font);
  /* ...все semantic-токены... */
}
:root { --bg: oklch(...); --fg: oklch(...); }                       /* light-normal (default) */
@media (prefers-color-scheme: dark) { :root { --bg:…; --fg:…; } }   /* system-dark */
[data-theme="dark"]  { --bg:…; --fg:…; }                            /* explicit dark */
[data-theme="light"] { --bg:…; --fg:…; }                            /* explicit light — бьёт media */
/* high-contrast: ДВА отдельных правила (нельзя смешивать селектор и @media в одном
   selector-list — это невалидный CSS, браузер дропнет весь блок). */
[data-contrast="high"] { --fg:…; --border:…; /* high-Lc */ }
@media (prefers-contrast: more) {
  :root:not([data-contrast="normal"]) { --fg:…; /* те же high-Lc; уважает явный normal */ }
}
[data-density="compact"] { --size-control-h-md:…; --space-control-pad-y:…; }
:root { --app-font: var(--font-geist-sans); }
[data-font="legible"] { --app-font: var(--font-atkinson); }
[data-font="serif"]   { --app-font: var(--font-serif); }
```

**Про `@theme`:** переключаемые *значения* живут как plain-CSS custom properties в `:root`/`[data-*]` (вне `@theme`), а `@theme inline` лишь маппит Tailwind-токены цвета/шрифта на них — поэтому `[data-*]`-оверрайды работают, и tree-shake (v4.0.5+) эти значения НЕ трогает (это авторский CSS, не `@theme`-токены; эмпирически подтверждено компиляцией через `@tailwindcss/postcss` 4.1.x). `@theme static` здесь не нужен. **Не-цветовые шкалы** (`--text-*`, `--radius-*`, `--shadow-*`, `--z-*`, `--duration-*`) объявляем в обычном `@theme` (не inline), чтобы Tailwind строил из них утилиты (`text-lg`, `rounded-md` …) с нашими значениями, а не дефолтными.

## 7. No-FOUC применение и гибридная персистентность (Next 16 + RSC)

- `src/utils/appearance.ts` (server): `getAppearance()` читает cookie через `next/headers`, парсит в `{ theme, contrast, density, font, textSize }` с дефолтами; чистая, тестируемая.
- Root layout (`src/app/layout.tsx`) ставит на `<html>`: `data-theme` (только если явный), `data-contrast`, `data-density`, `data-font`, `style={{ '--text-scale': n }}`, корректный `color-scheme` (`light` / `dark` / `light dark` для system). Всё SSR → без вспышки и без hydration mismatch.
- `AppearanceProvider` (client, `src/components/appearance/`): держит состояние + сеттеры. Сеттер **оптимистичен**: мутирует атрибут на `<html>` (мгновенный ре-тем — чистый var-swap) → пишет cookie → server action в бэк.
- **Гибрид cookie↔бэк:** бэк — авторитетный источник (кросс-девайс), cookie — быстрый SSR-кеш того же устройства. На старте SSR берёт cookie; когда грузится `me` с preferences и значение расходится — обновляем cookie из бэка и ре-тем. Аноним — только cookie. Бэк-поля ещё не готовы → cookie-путь самодостаточен; бэк-синк включаем, когда API появится (graceful degradation).

## 8. Типографика

- Type-scale модульный, rem-токены `--text-2xs…4xl` с парными line-height; Tailwind `--text-*` маппим на них. **Эти же токены потребляет слой `.content`** (§11) — единый источник, без дублирования.
- **Размер текста:** `html { font-size: calc(100% * var(--text-scale, 1)); }` (100% уважает системный размер браузера). Опции `0.9 / 1 / 1.125 / 1.25`.
- **Брейкпоинты — px** (Tailwind `--breakpoint-*`), чтобы лейаут не «прыгал» при масштабе; текст растёт внутри стабильной сетки. Трейд-офф: отказ от rem-брейкпоинтов (обратимо).
- **Шрифты:** 3 семейства через `next/font` — Geist (sans, есть), **Atkinson Hyperlegible** (доступный), serif для чтения (кандидат — **Source Serif 4**; альтернативы Newsreader/Lora, финально при реализации). Все var-классы на `<html>`; активный — `[data-font]` → `--app-font` → `--font-ui`. Своп без ре-загрузки.
- **Кириллица (важно — UI на `ru`):** у Atkinson Hyperlegible на Google Fonts НЕТ cyrillic-subset (только `latin`/`latin-ext`), и `next/font` падает на сборке при запросе несуществующего subset. Поэтому: Atkinson — `subsets:["latin","latin-ext"]`; в `FONT_STACKS.legible` кириллицу закрывает следующий в стеке Geist, у которого надо добавить `cyrillic` в subsets (сейчас только `latin`). То есть в legible-режиме латиница рендерится Atkinson, кириллица — Geist-фоллбеком (известное ограничение оси). Source Serif 4 cyrillic — подтвердить при реализации.
- CLS: `adjustFontFallback` + preload; меряем эмпирически, при необходимости — ручные `size-adjust`/override-метрики.

## 9. Плотность и spacing

- Базовая spacing-шкала (4px) — `--space-*`, фиксированная.
- Плотность драйвит **узкий набор semantic-токенов, потребляемых компонентами**: `--size-control-h-{sm,md,lg}`, `--space-control-pad-{x,y}`, `--space-stack`; разные значения per `[data-density]` (`comfortable`/`compact`). Гибрид Material (height-токены) + Atlassian (выбор шага) — без свободного умножения, ломающего лейаут.
- Компоненты `components/ui/*` перестают хардкодить `h-10 px-3` — берут эти токены.

## 10. Контраст

- `[data-contrast="high"]` → слой цветовых токенов с поднятыми Lc (body → 90+, бордеры → 45+, muted поднять). Дефолт-триггер `@media (prefers-contrast: more)` (если юзер явно не выбрал normal).
- **Уступаем `forced-colors: active`:** сохраняем блок системных цветовых ключевых слов (текущий в globals.css), не воюем с ОС, только точечные правки.

## 11. Длинный контент — слой `.content` (замена `prose`)

- Свой слой `.content` в `@layer components` (файл `src/styles/content.css`, импортится в globals), стилизующий сырые HTML-элементы Tiptap (StarterKit + extensions): `h1–h6, p, strong/em/s, a, ul/ol/li, blockquote, code, pre, hr, img, table/thead/tbody/tr/th/td`.
- **Единый источник истины:** `.content` потребляет ровно те же semantic-токены, что и UI (`--text-*`, `--color-fg/-muted/-link`, `--font-ui/-mono`, `--space-*`). Ноль bespoke-чисел, ноль дублирования.
- **Вертикальный ритм — чистый flow:** `.content > * + * { margin-block-start: var(--flow-space, <base>) }`, где `--flow-space` переопределяется per-элемент токеном (заголовки дышат свободнее). Односторонний логический margin, token-driven — без двусторонних margin'ов и collapsing плагина.
- **Убираем зависимость:** долой `@plugin "@tailwindcss/typography"` из globals.css и `@tailwindcss/typography` из package.json.
- **Размерный вариант:** `prose-sm` → модификатор `.content` (через `data-size="sm"`/`--content-scale`), на токенах. По умолчанию `.content` **без ограничения ширины** (ширину задаёт лейаут); читаемую меру (`max-inline-size: ~65ch`) делаем **opt-in** (`.content--measure`) для статейных вью.
- Миграция 21 файла: `prose` → `.content`; `prose prose-sm` → `.content` + size-модификатор; `max-w-none` отпадает (дефолт без меры). Покрыть оба сценария — read-view и поверхность `ast-editor` (`EditorContent`).

## 12. CI-гард на контраст

- `src/styles/tokens/__tests__/apca.test.ts` (vitest): импорт TS-модуля → для каждой пары `(theme, contrast)` и каждой пары `{ fg, bg, minLc }` из `apca-targets.ts` резолвим OKLCH→sRGB (**culori**), считаем Lc (**apca-w3** `APCAcontrast(sRGBtoY(fg), sRGBtoY(bg))`), `assert |Lc| ≥ minLc`.
- Гард пишем TDD-стилем и проверяем, что он **ловит заведомо плохую пару** (паттерн помечен research'ем как «синтез» — валидируем сами).
- Таблица таргетов — машиночитаемый список `{ pair: [fgToken, bgToken], minLc }[]`, самодокументируемый и итерируемый.

## 13. Настройки в аккаунте + интеграция

- Расширяем слайс `preferences`: **отдельная `AppearancePrefsSchema`** (theme/contrast/density/font/text_size) — НЕ вливаем в `PreferencesUpdateSchema`, чтобы не сломать существующий `updatePreferences` (он шлёт `reading_mode`). Схема реально используется: ею валидируется body в `persistAppearance` с явным маппингом camelCase→snake_case (`text_size: a.textSize`). Единый источник enum-значений (массивы `THEMES/CONTRASTS/...`) переиспользуется и клиентским `parseAppearance`, и `z.enum`. Бэк-персист — координированно (открытые бэк-аски); до готовности бэка работает cookie-путь.
- Страница `/me/settings` → секция «Внешний вид» с контролами (Base UI Select/RadioGroup) на каждую ось. Server component читает текущий appearance; client-контролы вызывают сеттеры.
- **RBAC:** настройки self-scoped — любой авторизованный меняет своё (`can`/`requireCapability` не требуется для собственных preferences сверх существующего паттерна слайса). Аноним — cookie-only.
- Хедер-переключатель темы для анонимов — опционально, отдельной задачей (вне scope этого PR).

## 14. Наложение на существующий код (фазировка)

Сначала чистый каркас, потом наложение:

1. **Скелет (clean-room):** TS-токены + генератор + `tokens.generated.css` + `@theme inline`-проводка + apcach-деривация + APCA-CI-гард. Палитра проходит тесты.
2. **Рантайм темизации:** `appearance.ts`, проводка root layout, `AppearanceProvider`, `color-scheme`. Все 4 оси переключаются.
3. **Наложение:** **compat-shim** — старые имена (`--color-background`, `--color-foreground`, `--color-text-pane`, …) делаем алиасами новых токенов, чтобы ничего не сломать разом; затем мигрируем `components/ui/*` на новые токены/шкалы, выпиливаем хардкод размеров, заменяем `prose` → `.content`, убираем старую палитру (`rebus.css`) и typography-плагин.
4. **Настройки + бэк-синк:** расширение `preferences`, секция в settings, персист в бэк.

Compat-shim критичен: параллельные агенты продолжают работать на старых именах, пока идёт миграция. Запретные зоны (`globals.css`, `layout.tsx`, `components/ui/*`, `package.json`) трогаются только в рамках этого foundation-PR. `src/api/schema.ts` — только когда бэк добавит поля.

## 15. Структура файлов

```
src/styles/tokens/
  primitives.ts        # сырые OKLCH-рампы + не-цветовые шкалы (apcach-деривация)
  semantic.ts          # semantic→primitive маппинги per (theme × contrast); density/text/font слои
  scales.ts            # spacing, type, radius, shadow, z, duration, density
  apca-targets.ts      # таблица Lc-таргетов (пары fg/bg)
  index.ts             # собранная модель токенов (единый импорт: генератор + тесты + при необходимости рантайм)
  __tests__/apca.test.ts
src/styles/tokens.generated.css   # GENERATED — @theme inline + слои-оверрайды
src/styles/content.css            # слой .content (flow), на токенах
src/styles/globals.css            # импортит generated + content + глобальные правила
scripts/generate-tokens.mjs       # генератор (прецедент: scripts/generate-sw-assets.mjs)
src/utils/appearance.ts           # server: getAppearance() из cookie
src/components/appearance/         # AppearanceProvider, сеттеры, switchers
src/features/preferences/          # расширенная схема + UI настроек «Внешний вид»
```

**Генерация:** скрипт `generate:tokens` в package.json; сгенерированный CSS **коммитим** + CI-проверка актуальности (`generate:tokens && git diff --exit-code`), чтобы артефакт был ревьюабельным и без дрифта.

## 16. Зависимости

- Добавить: `apcach` (деривация, dev), `apca-w3` + `culori` (тест/деривация, dev), `next/font` шрифты Atkinson Hyperlegible + serif (через `next/font/google`).
- Удалить: `@tailwindcss/typography`.
- Опционально (на будущее, не сейчас): `bridge-pca` для WCAG-2 паритета.
- Всё через **pnpm** (npm ломает тулчейн).

## 17. Стратегия тестирования

- **APCA-гард** (vitest) — см. §12; обязателен, блокирующий.
- **`getAppearance()`** — юнит-тесты парсинга cookie/дефолтов.
- **`AppearanceProvider`/сеттеры** — тесты оптимистичного применения + записи cookie (Testing Library).
- **Генератор токенов** — снапшот сгенерированного CSS + проверка актуальности в CI.
- **CLS шрифтов** — эмпирическая проверка (известный баг `adjustFontFallback`).
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## 18. Риски и открытые вопросы

- **APCA не нормативен** — внутренняя планка, не юридическое соответствие; при необходимости — WCAG 2.x AA через `bridge-pca`.
- **`adjustFontFallback`** может игнорироваться для Google-шрифтов в рантайме (баг Next) — CLS мерить, иметь fallback-план с ручными метриками.
- **Бэк-поля appearance** ещё не готовы — закладываем cookie-путь как самодостаточный, бэк-синк отдельной задачей (координация с philosophy-api).
- **px-брейкпоинты** — отступление от дефолта Tailwind v4; обратимо.
- **serif-шрифт** — финальный выбор семейства при реализации (кандидат Source Serif 4).
- **CI-гард** — паттерн «синтезирован», валидируем собственными тестами.
- **legible-шрифт на кириллице** — Atkinson не покрывает кириллицу → русский текст в legible-режиме рендерится Geist-фоллбеком (см. §8). Принято как ограничение.
- **Полная миграция legacy-токенов (~158 файлов, вкл. запретные зоны)** — решение пользователя: мигрируем всё в этом координированном foundation-PR (а не оставляем постоянный shim). Затрагивает admin-shell, `components/app|permission` — санкционировано как единый foundation-PR (CLAUDE.md). Compat-shim — временный мост, удаляется в конце фазы наложения.
- **Дрейф `tokens.generated.css`** — pnpm@8 НЕ запускает `prebuild` → генерация встроена прямо в `build` через `&&` (как у sw-assets) + CI-шаг `generate:tokens && git diff --exit-code`; snapshot-тест живёт в `src/` (vitest `include` = `src/**`).

## 19. Вне scope (YAGNI сейчас)

- Полный DTCG-пайплайн (Style Dictionary/Terrazzo) — отложен до design-tool interop / нативных платформ.
- OpenDyslexic как ось — не закладываем (нет доказательной базы); можно opt-in позже.
- Хедер-переключатель темы для анонимов — отдельной задачей.
- Fluid/clamp type-scale — модульной шкалы достаточно; добавим точечно для display-заголовков при необходимости.

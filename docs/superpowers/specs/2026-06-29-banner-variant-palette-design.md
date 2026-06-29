# Баннеры: семантическая палитра вместо произвольного hex — дизайн

Дата: 2026-06-29. Статус: дизайн (под реализацию после контракт-изменения бэка).

## Контекст и проблема

Сейчас `banner.background_color: string` — произвольный hex, который админ задаёт
сырым `<input type="color">` ([banner-edit-form.tsx](../../../src/features/banners/ui/banner-edit-form.tsx),
[banner-create-form.tsx](../../../src/features/banners/ui/banner-create-form.tsx)).
Рендер кладёт его инлайном: `style={{ backgroundColor }}` в
[active-banners.tsx](../../../src/features/banners/ui/active-banners.tsx) и
[banner-admin-row.tsx](../../../src/features/banners/ui/banner-admin-row.tsx).

Три проблемы:

1. **CSP.** Это последние SSR `style="..."`-атрибуты в проекте — единственное, что
   мешает дожать `style-src-attr` без `'unsafe-inline'` (CSP Level 2, см.
   [[csp-style-src-hardening]] / `src/security/csp.ts`). Динамический hex нельзя ни в
   класс, ни в hash, ни под nonce.
2. **A11y.** Модель несёт только фон, без парного цвета текста → контраст текста на
   админском фоне не управляется (можно выбрать `#ffff00` и получить нечитаемый текст).
3. **Продукт.** Сырой hex на сквозном высоковидимом элементе — footgun (мимо темы,
   мимо dark-mode, мимо бренда).

**Прецедент:** GitLab в 14.10 убрал произвольный hex broadcast-сообщений и ввёл
предопределённые «темы» — ради консистентности и контраста. Mattermost оставил цвет,
но всегда **парой** bg+fg с авто-контрастом. GitHub Primer flash — фиксированные
семантические варианты. Зрелый тренд — семантическая палитра, не RGB-пикер.

## Решение

`background_color: string` → `variant: enum`. FE резолвит вариант в **существующую
контраст-пару токенов** через статический CSS-класс. Инлайн-стиль исчезает →
CSP-проблема закрыта в корне; контраст и dark-mode гарантированы APCA-токенами.

### Семантика (источник истины)

| variant | bg | fg | смысл |
|---|---|---|---|
| `info` (дефолт) | `--color-info-bg` | `--color-info-fg` | общее объявление |
| `success` | `--color-success-bg` | `--color-success-fg` | позитив/резолв |
| `warning` | `--color-warning-bg` | `--color-warning-fg` | предупреждение |
| `danger` | `--color-danger-bg` | `--color-danger-fg` | критично/срочно |
| `brand` | `--color-accent` | `--color-accent-fg` | промо/бренд |
| `neutral` | `--color-surface-subtle` | `--color-fg` | спокойное уведомление |

Токены уже эмитятся во всех слоях (light/dark/high-contrast) из
`scripts/generate-tokens.mjs` → новые токены НЕ нужны.

## Backend-контракт (выдан отдельно)

`banner.Banner` / `CreateRequest` / `UpdateRequest`: убрать `background_color string`,
добавить `variant` (string-enum: `info|success|warning|danger|brand|neutral`,
required в Create). Валидация — отклонять неизвестный вариант (как `target_audience`);
снять `hexColorRe`. Цвета на проводе нет — только ключ. Миграция существующих строк:
hex → дефолт `info` (или маппинг по hue — на усмотрение бэка). FE-стопгап до регена
`src/api/schema.ts` — см. ниже.

## FE-изменения по файлам

1. **`@/api/enums`** — добавить `BANNER_VARIANTS = ["info","success","warning","danger","brand","neutral"]`
   + тип `BannerVariant`. (Симметрично `BANNER_TARGET_AUDIENCES`.)
2. **`features/banners/variant.ts`** (новый, чистый, server+client) — единый источник:
   - `BANNER_VARIANT_CLASS: Record<BannerVariant, string>` → `"banner--info"` и т.п.
   - `variantLabel(v, t?)` + дефолты-литералы (как `audienceLabel` в `display.ts`).
   - `DEFAULT_BANNER_VARIANT = "info"`.
3. **CSS** — классы `.banner--{variant}{ background-color: var(--color-{v}-bg); color: var(--color-{v}-fg) }`
   в `src/styles/content.css` (или новом `banners.css`, импортируемом в globals).
   Чистый статический CSS, ноль инлайна.
4. **`schemas.ts`** — `background_color` (hex regex) → `variant: z.enum(BANNER_VARIANTS)`.
   Снять `HEX_COLOR_RE`. Обновить `BannerInputCommon`/`normalizeFields`.
5. **`display.ts`** — удалить `toColorInputValue`; (variant-хелперы живут в `variant.ts`).
6. **Формы** ([banner-create-form](../../../src/features/banners/ui/banner-create-form.tsx),
   [banner-edit-form](../../../src/features/banners/ui/banner-edit-form.tsx)) — заменить
   `ColorInput` на радио-группу вариантов со свотчем-превью (kit `RadioGroup`; паттерн как
   у иконочного radio выравнивания текста). Поле `name="variant"`.
7. **Рендер** — [active-banners](../../../src/features/banners/ui/active-banners.tsx) и
   [banner-admin-row](../../../src/features/banners/ui/banner-admin-row.tsx):
   `style={{ backgroundColor }}` → `className={cn(base, BANNER_VARIANT_CLASS[variant])}`.
   Admin-свотч — тот же класс на квадратике.
8. **i18n** — `banners.variant*` ключи (label каждого варианта) в `ru/en/ar/zh`.
9. **Тесты (TDD)** — `schemas.test` (variant enum/коэрсинг), `variant.test` (class-map),
   render-тесты (нет `style=`, есть класс), форм-тесты (радио → submit `variant`).

## CSP-фоллоуап (после баннеров — отдельные шаги)

10. **Флип политики** в `src/security/csp.ts`: добавить `style-src-attr 'self'` без
    `'unsafe-inline'` (и убрать его из `style-src`). Гейт: ноль SSR-инлайнов (баннеры были
    последними). TDD-тест на наличие `style-src-attr` без unsafe-inline.
11. **ESLint-гард** — запрет `style={}` в server-компонентах слайсов (как гард на
    `react-dom/client`), + санкционированный escape-hatch (нонсенный `<style>`-хелпер).

## Стопгап / FE↔BE координация

FE проектируется против **будущего** контракта (`variant`). До регена `src/api/schema.ts`
бэком на проводе ещё `background_color`.

**РЕШЕНО (2026-06-29): вариант A.** Ждём, пока бэк выкатит `variant` + реген
`src/api/schema.ts`, затем весь FE — одним чистым PR по TDD. Без стопгап-адаптера, без
временного кода. FE-реализация **заблокирована на бэк-контракт**; возобновить, когда
`banner.Banner.variant` появится в схеме. (Отклонён B — FE-адаптер `background_color→variant`:
не нужен временный код, раз FE и так ждёт чистый контракт.)

Инлайн-стиль и CSP-флип (`style-src-attr` без `unsafe-inline`) в любом случае делаются
только когда `variant` доступен (иначе нечем красить класс).

## Открытые вопросы

- Имя поля: `variant` (предложено) vs `tone`/`style`. `variant` — нейтрально, не намекает
  на упорядоченность (важно: brand/neutral — не severity).
- `brand` насыщенный (solid accent), остальные — мягкие тинты. Осознанно (промо ≠ статус).
  Если нужен мягкий бренд — добавить `--accent-bg` токен (сейчас нет).
- Нужен ли `neutral` отдельно от `info` — да: `neutral` в тон поверхности (тихо), `info`
  синий (привлекает внимание).

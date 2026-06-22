# Дизайн: пользовательская таймзона отображения дат

**Дата:** 2026-06-21
**Статус:** на ревью
**Тип:** foundation-update (трогает i18n-фасад + root layout + utils — не feature-слайс)

## Проблема

Сейчас отображение дат централизовано в форматтере `src/i18n/format.ts`
(`getFmt(locale).dateTime(...)`), и оно локализовано по языку (`ru→ru-RU`,
`en→en-US`). Но **часовой пояс не управляется единообразно**:

1. **Часть мест жёстко прибита к UTC** (`timeZone:"UTC"`): комментарии, баннеры,
   timed-события, история ревизий, сохранённая лекция. Пользователь в МСК видит
   время на 3 часа раньше, без пометки зоны.
2. **Часть мест «плавает»** — без `timeZone`: аудит, отправки форм, glossary,
   users, annotations, а также два **клиентских** компонента — share-links и
   tokens. «Плавающие» места рендерятся в TZ окружения.
3. Следствие A — **hydration mismatch** в клиентских
   [share-link-list.tsx](../../../src/features/share-links/ui/share-link-list.tsx)
   и [token-list.tsx](../../../src/features/tokens/ui/token-list.tsx): SSR
   рендерит в TZ сервера (Alpine = UTC), браузер — в локальной TZ → React
   ругается, значение «прыгает» после гидрации.
4. Следствие B — **dev/prod-хрупкость**: «плавающие» места в проде показывают
   UTC лишь потому, что Alpine по умолчанию UTC и `TZ` не задан. На dev-машине
   (локальная TZ) те же даты выглядят иначе; смена базового образа молча сдвинет
   всё.

Бэкенд уже добавил преференс таймзоны (см. контракт ниже). Задача — реализовать
на фронте управление таймзоной отображения, починив при этом оба следствия.

## Цели

- TZ становится **явным централизованным параметром слоя форматтера**, наравне с
  locale. Прикладные call-sites перестают задавать `timeZone` вручную.
- Источник TZ — **пользовательский преференс** (бэкенд `/api/me/preferences`),
  отражённый в cookie для синхронного SSR (как `locale`/`appearance`).
- Детерминированный рендер на сервере и клиенте → **hydration mismatch и
  dev/prod-дрейф устранены by construction**.
- UI выбора зоны в `/me/settings`: `Авто (как в браузере)` (= `system`) + полный
  список IANA-зон.

## Не-цели (YAGNI)

- Не вводим зоны для полей-**только-дата** — они остаются UTC (см. правило ниже).
- Не чиним семантику `<input type="datetime-local">` в формах баннеров/событий
  (отдельный pre-existing вопрос, см. «Связанное, вне объёма»).
- Не делаем относительное время («3 часа назад») — возможное улучшение позже.
- Не трогаем серверный рендер sitemap/прочих не-UI дат.

## Контракт бэкенда (подтверждён)

`preference.Preferences` и `preference.UpdatePreferencesRequest`
([schema.ts](../../../src/api/schema.ts)):

```ts
timezone: string   // IANA-зона ("Europe/Moscow") ЛИБО "system".
                   // Поле ВСЕГДА присутствует, дефолт "system".
                   // "system" = клиент резолвит зону из браузера.
                   // Неизвестная зона при PATCH → 422.
```

GET `/api/me/preferences` отдаёт `timezone` как есть (`system`/IANA), не резолвит
на бэке. PATCH принимает то же поле (паттерн уже используется для `reading_mode`,
`locale`, `appearance`).

## Ключевое отличие от locale: резолв `system`

`getLocale()` резолвит `system` на сервере через заголовок `Accept-Language`. Для
TZ **серверного аналога нет** — браузерную зону знает только клиентский `Intl`.
Поэтому:

- `pref = <IANA>` → используем зону и на сервере, и на клиенте → рендер
  детерминирован.
- `pref = "system"` → сервер рендерит **фиксированным фолбэком**
  `Europe/Moscow`; клиент после mount читает
  `Intl.DateTimeFormat().resolvedOptions().timeZone` и уточняет.

Чтобы первый клиентский рендер совпадал с SSR (иначе вернётся mismatch),
коррекция приходит **после** гидрации (через state провайдера), а не во время неё.

## Архитектура

### 1. Cookie-модель (одна cookie, JSON — как appearance)

Cookie `tz`, JSON: `{ pref: "system" | <IANA>, resolved: <IANA> }`.

- `pref` — что выбрал пользователь; зеркалит бэкенд; управляет значением Select.
- `resolved` — конкретная IANA-зона для форматтера. При `pref=<IANA>`
  совпадает с `pref`. При `pref="system"` — браузерная зона (после первого
  определения клиентом) либо фолбэк `Europe/Moscow`.

Файл `src/utils/timezone.ts` (аналог
[appearance-cookie.ts](../../../src/components/appearance/appearance-cookie.ts)):
`TZ_COOKIE`, `DEFAULT_TZ_PREF="system"`, `FALLBACK_ZONE="Europe/Moscow"`,
`parseTzCookie(raw)`, `serializeTzCookie(v)`, валидация зоны через
`Intl.supportedValuesOf("timeZone")`. Client-safe (без `server-only`).

### 2. Серверное чтение

`src/utils/timezone-server.ts` (аналог
[locale.server.ts](../../../src/i18n/locale.server.ts) +
[utils/appearance.ts](../../../src/utils/appearance.ts)), per-request `cache`:

- `getStoredTzPref(): Promise<"system"|IANA>` — читает `pref` из cookie; если
  cookie нет и юзер залогинен → seed из `getPreferences().timezone`; иначе
  `DEFAULT_TZ_PREF`.
- `getServerTz(): Promise<string>` — возвращает **конкретную IANA** для
  форматтера: `resolved` из cookie, иначе при `pref="system"` → `FALLBACK_ZONE`,
  иначе `pref`.

### 3. Форматтер — TZ как параметр

[format.ts](../../../src/i18n/format.ts): `getFmt(locale, timeZone?)`. В `dateTime`
зона подставляется дефолтом, но **caller может переопределить**:

```ts
dateTime(value, opts) {
  // timeZone из opts имеет приоритет → call-site может форсить UTC (date-only)
  const merged = timeZone ? { timeZone, ...opts } : opts;
  ...new Intl.DateTimeFormat(tag, merged).format(d);
}
```

Ключ кеша форматтеров строится из эффективных opts (включая зону) — корректность
кеша сохраняется.

- [index.ts](../../../src/i18n/index.ts): `getServerFmt()` =
  `getFmt(await getLocale(), await getServerTz())`.
- [client.tsx](../../../src/i18n/client.tsx): `useTz()` (из провайдера, см. ниже);
  `useFmt()` = `getFmt(useLocale(), useTz())`.

### 4. Клиентский провайдер + коррекция `system`

`src/components/timezone/timezone-provider.tsx` (легче AppearanceProvider):

- Принимает от сервера `initial = { pref, resolved }`.
- Держит `resolved` в state; `useTz()` читает его.
- `useEffect` на mount: если `pref==="system"`, берёт браузерную зону; если она
  ≠ `resolved` → `setResolved(browser)` **и** пишет `resolved` в cookie
  (`pref` не трогает). Первый клиентский рендер использует серверный `resolved`
  → совпадает с SSR; коррекция — пост-гидрационный state-update.
- Монтируется в [layout.tsx](../../../src/app/layout.tsx) рядом с
  `AppearanceProvider`/`I18nProvider`, seed = `await getServerTz()` +
  `getStoredTzPref()`.

### 5. Правило по типам дат (применяется к call-sites)

Классификация — **по природе значения в данных**, а не по тому, показано ли
время в выводе:

| Тип значения | Примеры | Поведение | Действие |
|-----|-----|-----------|----------|
| **Таймстемп** (RFC3339, есть время) — даже если выводится только дата | комментарии, аудит, ревизии, истечение токенов/share, отправки форм, timed-события, `updated_at` в users/glossary/annotation | Зона преференса | **Убрать** явный `timeZone:"UTC"`, где он стоял; «плавающие» наследуют автоматически |
| **Чистая дата** (нет времени в данных) | `all_day`-события (`YYYY-MM-DD`), синтетическая дата метки месяца в `resolveMonthRange` | Всегда UTC (без сдвига → нет off-by-one-day) | **Сохранить** `timeZone:"UTC"` |

`updated_at`, показанный как дата без времени (users/glossary/annotation), —
это таймстемп: применяем зону преференса, чтобы календарный день был верен для
пользователя. UTC оставляем только там, где в данных нет компонента времени.

Изоморфные хелперы получают зону параметром (зеркало того, как получают `locale`):
`formatCommentDate(iso, locale, tz)`,
`formatBannerDate(value, locale, tz)`,
`formatEventDate(value, allDay, locale, tz)` (tz применяется только к timed;
all-day остаётся UTC внутри хелпера). Вызыватели передают `tz` из
`getServerTz()` / `useTz()`.

Следствия A и B чинятся автоматически: клиентские share-links/tokens теперь несут
явную, засеянную сервером зону → SSR и клиент детерминированы.

### 6. UI настроек

`src/app/me/settings/timezone-settings.tsx` (аналог
[locale-settings.tsx](../../../src/app/me/settings/locale-settings.tsx)),
client component:

- `Select`: первый пункт `Авто (как в браузере)` (= `system`) + полный список
  `Intl.supportedValuesOf("timeZone")`.
- `onChange`: пишет cookie `tz` (`pref` = выбор; `resolved` = выбор при IANA, либо
  браузерная зона/фолбэк при `system`), вызывает `persistTimezone(pref)`
  (server action, PATCH `/api/me/preferences`, graceful — как
  [persist-locale.ts](../../../src/i18n/persist-locale.ts)), затем
  `router.refresh()` для перечитки серверных дат.
- Секция добавляется в [settings/page.tsx](../../../src/app/me/settings/page.tsx)
  рядом с language; `initial` = `getStoredTzPref()`.

Строки — namespace `settings` (ru+en).

## Граничные случаи

- **Гость:** cookie нет → `pref="system"`, SSR `Europe/Moscow`, клиент уточняет.
  Бэкенд не дёргается (PATCH только для залогиненных, как `persistLocale`).
- **`system`-юзер вне фолбэк-зоны, первый визит:** server-компоненты (аудит и
  т.п.) на первой странице показывают `Europe/Moscow`; после первого
  `useEffect`-определения `resolved` пишется в cookie, и со следующей навигации
  SSR корректен. Клиентские компоненты (share/tokens) корректны сразу после
  mount. Для явно выбранной зоны всё корректно всегда. Это документированный,
  единичный нюанс SSR + ambient browser data; для RU-аудитории (браузер = МСК =
  фолбэк) визуально незаметен.
- **no-JS, `system`:** остаётся `Europe/Moscow`. Приемлемо.
- **Невалидная зона в cookie:** `parseTzCookie` отбрасывает в `system`/фолбэк.
- **PATCH 422 (неизвестная зона):** в UI Select предлагает только зоны из
  `Intl.supportedValuesOf` → 422 недостижим в норме; на всякий — branded-ошибка.

## Тестирование

- `format.test.ts`: инъекция зоны (`getFmt("ru","Europe/Moscow")` vs `"UTC"`),
  приоритет `opts.timeZone` над дефолтом (date-only override).
- `timezone.test.ts`: parse/serialize cookie, валидация зоны, фолбэк.
- `timezone-server.test.ts`: cookie → resolved; `system` → фолбэк; seed из бэка.
- `timezone-provider.test.tsx`: первый рендер = серверный resolved (нет
  mismatch); пост-mount коррекция для `system`; запись `resolved` в cookie.
- Обновить снапшоты/ассерты затронутых call-sites (date-only остаются UTC).
- `persist-timezone`: PATCH-тело `{timezone}`, graceful при отсутствии auth.

## Файлы

**Новые:** `src/utils/timezone.ts`, `src/utils/timezone-server.ts`,
`src/i18n/persist-timezone.ts`, `src/components/timezone/timezone-provider.tsx`
(+ index), `src/app/me/settings/timezone-settings.tsx` (+ тесты).

**Изменяемые:** `src/i18n/format.ts` (сигнатура `getFmt`),
`src/i18n/index.ts` (`getServerFmt`), `src/i18n/client.tsx` (`useTz`/`useFmt`),
`src/app/layout.tsx` (провайдер + seed), `src/app/me/settings/page.tsx` (секция),
изоморфные хелперы `comment-format.ts` / `banners/display.ts` /
`events/calendar.ts` (+ их вызыватели), снятие `timeZone:"UTC"` на
timestamp-местах, простановка `timeZone:"UTC"` на date-only-местах, строки
`settings` (ru+en).

> `src/i18n/*`, `src/app/layout.tsx`, `src/utils/*` — запретные зоны для
> feature-слайсов. Этот PR — **именно foundation-update**, поэтому касание
> допустимо и координируется отдельно от фич.

## Связанное, вне объёма (флаги)

- **Формы баннеров/событий** ([banner-edit-form.tsx](../../../src/features/banners/ui/banner-edit-form.tsx),
  [event-edit-form.tsx](../../../src/features/events/ui/event-edit-form.tsx))
  используют `<input type="datetime-local">` (локальное wall-clock браузера) с
  `.slice(0,16)` от UTC-строки — ввод и отображение трактуют зону по-разному.
  Это pre-existing UX-несоответствие; чинить отдельно, согласовав, в какой зоне
  админ задаёт расписание.
- **Бэкенд-флаг:** подтвердить, что GET `/api/me/preferences` возвращает
  `timezone` без резолва `system` (FE на это рассчитывает). По описанию контракта
  — да.

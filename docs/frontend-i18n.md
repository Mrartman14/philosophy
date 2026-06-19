# Фронтенд i18n: чеклист раскатки

Фиксируем паттерн единообразного выноса строк по слайсам.

## Что уже есть

- Фасад `@/i18n` (server) / `@/i18n/client` (client)
- Каталоги `src/i18n/messages/{ru,en}.ts`
- ESLint Guardrail 5 (запрет на direct `next-intl` импорты)
- Seam форматирования `getFmt`
- Пилоты: notifications (ICU-плюрал), comments (даты)

## Как добавить строку

1. Добавить ключ в `ru.ts` (источник истины формы)
2. Добавить тот же ключ в `en.ts` (`satisfies Messages` заставит)
3. Использовать:
   - `useT("<namespace>")` (client)
   - `await getT("<namespace>")` (server)
4. Числа/даты — через:
   - `useFmt()`/`getServerFmt()` (general)
   - `getFmt(locale)` (specific)

## Дисциплина ICU

- **Используй только:** `{var}` и `{count, plural, …}`
- **НЕ используй:** `select`, `selectordinal`, rich-теги, skeleton (держит каталог переносимым и дешёвой замену библиотеки)
- **Для русского:** всегда заполнять `one/few/many/other`

## Границы фасада

Прикладной код НИКОГДА не импортирует `next-intl` напрямую (форсит Guardrail 5).

Если нужна фича next-intl, которой нет в фасаде — добавить тонкую обёртку в `src/i18n`, не пробрасывать наружу сырой API.

**Важно:** `useT` реэкспортит `useTranslations` целиком, значит `t.rich`/`t.markup`/`select` технически доступны прикладному коду. Запрет на них держится ТОЛЬКО соглашением + код-ревью, не линтером. Если захотим форсить машинно — нужна обёртка `t`, не пробрасывающая `.rich`.

## Реальная цена свопа (честно)

«Переписать один модуль» точно для `getFmt` (Task 2) и модели локали (Task 1) — чистый seam над `Intl.*`.

НО формат ICU-плюрала в каталогах (`{count, plural, …}`) — это рантайм-фича библиотеки, а не переносимые данные. При замене next-intl на самопись придётся либо:
- Портировать ICU-плюрал-эвалуатор (это часть веса, который и даёт next-intl)
- Переписать plural-каталоги и вызовы `t(key, {count})`

Своп-готовность = «фасад + форматтеры тонкие + ICU-формат стандартен», но **ICU-рантайм — осознанная привязка**, а не нулевая.

## Очередь слайсов для выноса строк

Известные источники backend-/UI-текста (вынести в каталоги):

- Шаблоны/ветки в `src/utils/api-error.ts` (DEFAULT_MESSAGES)
- Ошибки в `src/features/*/errors.ts`
- Branded-тексты forbidden/suspended
- Push UI (`src/features/preferences/ui/*`)
- Zod-сообщения форм (`src/features/*/schemas.ts` — через `getT` на сервере)
- Прочие захардкоженные русские строки в `*.tsx` по слайсам

**Замечание:** серверные строки (Zod/api-error помечены `server-only`) брать через `getT`/`getServerFmt`, а не client-хуки.

## Прочие `Intl.*` для миграции на `getFmt`

Известные места хардкода `"ru-RU"`:

- `src/features/events/calendar.ts`
- `src/features/events/ui/calendar-view*`
- `src/features/banners/*`
- `src/features/search/*`
- `src/features/audit/ui/audit-table.tsx`
- `src/features/share-links/*`
- `src/features/revision-history/*`
- `localeCompare("ru")` в `src/app/admin/tags/page.tsx`
- `localeCompare` в `src/features/glossary/ui/glossary-list.tsx`

Список ориентировочный — сверять `grep -rn 'Intl\.\|localeCompare' src`.

## Вне scope (зафиксировано)

- Контентный i18n (лекции/глоссарий — модель данных на бэке)
- RTL/logical-CSS (нет RTL-языков)
- Reconcile-on-load локали — засев cookie из `preferences.locale` на свежей сессии (требует backend-fetch в резолве локали; отложено единым заходом с appearance-reconcile)
- `Me.locale` не нужен — локаль живёт на `preference.Preferences`, не на user-объекте

## Финальная проверка (после всех задач)

- Run: `pnpm lint && pnpm test && pnpm build` — всё зелёное
- Run: `grep -rn 'from "next-intl' src | grep -v 'src/i18n/'` — пусто (фасад герметичен)
- Ручная проверка: переключение языка в `/me/settings` меняет локализованные строки (notifications) и формат дат после `router.refresh()`

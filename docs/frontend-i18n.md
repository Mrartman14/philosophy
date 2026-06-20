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

## Делкатные кейсы — как локализовать

Три рекуррентных кейса с готовыми паттернами. Sonnet-батчи КОПИРУЮТ дословно.
Референс-реализации: `src/utils/api-error.ts`, `src/features/preferences/{schemas,actions}.ts`,
`src/features/preferences/ui/push-send-form.tsx`. Namespace'ы: `errors`, `validation`,
плюс per-feature (напр. `preferences`).

### Архитектурный инвариант

Server-only слой (`schemas.ts`, `api-error.ts`) остаётся СИНХРОННЫМ и НЕ импортирует
`next-intl` (Guardrail 5). Перевод server-сообщений происходит:

- для **Zod** — при разборе формы, через фабрику схемы `makeXSchema(t)`, где
  `t = await getT("validation")` (request-scope);
- для **api-error** — ОДИН раз на границе action: `rethrowApiError` несёт КЛЮЧ
  каталога в `ApiMessageError`, а `createAction → toResult → resolveErrorMessage`
  резолвит его в текст;
- для **branded forbidden** (Case 3) — на КЛИЕНТЕ через `useT("errors")`.

`resolveErrorMessage` (в `@/i18n`) деградирует к каталогу `DEFAULT_LOCALE` вне
request-scope (юнит-тесты), поэтому action-тесты, проверяющие `result.error`,
видят ru-текст без моков.

### Case 1 — Zod-сообщения форм (схема-фабрика `makeSchema(t)`)

Схема перестаёт быть `const` и становится фабрикой, принимающей переводчик
namespace `validation`. Сообщения — КЛЮЧИ каталога, не литералы.

Было (`src/features/<f>/schemas.ts`):

```ts
export const PushSendSchema = z.object({
  title: z.string().trim().min(1, "Введите заголовок").max(200, "До 200 символов"),
});
export type PushSendInput = z.infer<typeof PushSendSchema>;
```

Стало:

```ts
import type { NamespaceT } from "@/i18n";
type ValidationT = NamespaceT<"validation">;

export function makePushSendSchema(t: ValidationT) {
  return z.object({
    title: z.string().trim().min(1, t("pushSend.titleRequired")).max(200, t("pushSend.titleMax")),
  });
}
export type PushSendInput = z.infer<ReturnType<typeof makePushSendSchema>>;
```

В action (`src/features/<f>/actions.ts`):

```ts
import { getT } from "@/i18n";
// было: const input = parseFormData(PushSendSchema, formData);
const input = parseFormData(makePushSendSchema(await getT("validation")), formData);
// для .parse(): makePushSubscribeSchema(await getT("validation")).parse(raw)
```

В тесте схемы (`schemas.test.ts`):

```ts
import type { NamespaceT } from "@/i18n";
const t = ((key: string) => key) as unknown as NamespaceT<"validation">;
const PushSendSchema = makePushSendSchema(t); // дальше — как раньше
```

Правила:

- Фабрика нужна ТОЛЬКО если в схеме есть переводимая строка. Схемы только с
  enum/типами (напр. `PreferencesUpdateSchema`) остаются `const`.
- Ключи валидации кладутся в `src/i18n/messages/{ru,en}/validation.ts` под
  под-объектом-неймспейсом формы (`pushSend.*`); переиспользуемые — в `common`-секцию.

### Case 2 — api-error `DEFAULT_MESSAGES` + per-feature overrides (код → ключ)

Карта значений переезжает с текста на КЛЮЧ namespace `errors`. Тип меняется на
`ApiErrorMessageKeys`. `rethrowApiError` сам выберет ветку: значение-ключ каталога
→ `ApiMessageError(key)` (локализуется), легаси-текст → `Error(text)`.

Было (`src/features/<f>/actions.ts`):

```ts
import { rethrowApiError, type ApiErrorMessages } from "@/utils/api-error";
const ERRORS: ApiErrorMessages = {
  INVALID_DATE: "Бекенд отклонил дату: проверьте формат.",
};
```

Стало:

```ts
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
const ERRORS: ApiErrorMessageKeys = {
  INVALID_DATE: "INVALID_DATE", // ключ из ru/errors.ts + en/errors.ts
};
// вызов `rethrowApiError(error, ERRORS)` НЕ меняется
```

Плюс добавить ключ(и) в `src/i18n/messages/{ru,en}/errors.ts`:

```ts
// ru/errors.ts:  INVALID_DATE: "Бекенд отклонил дату: проверьте формат.",
// en/errors.ts:  INVALID_DATE: "The backend rejected the date: check the format.",
```

Правила:

- Общие коды (`REF_NOT_FOUND`, `VERSION_MISMATCH`, idempotency-коды) уже в
  `DEFAULT_MESSAGES` (api-error.ts) — слайсу их перечислять НЕ нужно.
- Тип `ApiErrorMessages` (text) ОСТАВЛЕН как легаси-канал на время миграции:
  немигрированные слайсы компилируются без изменений.
- Тесты `rethrow*`, проверявшие текст thrown-ошибки, переписать на класс+ключ:
  `expect(thrown).toBeInstanceOf(ApiMessageError); expect(thrown.messageKey).toBe("…")`.
  Тесты, проверяющие `result.error` через action-wrapper, остаются на ru-тексте
  (резолвится фоллбеком `resolveErrorMessage`).
- CONFLICT-под-маппинг по `err.error` (как в `users/errors.ts`) — отдельный
  паттерн: локализуй его карту как обычный per-feature namespace (`getT` в UI
  или ключ+ApiMessageError, если станет нужно).

### Case 3 — branded forbidden/suspended (общий шаблон + per-feature действие)

Один общий шаблон `errors.forbiddenAction = "У вас нет прав на {action}."` плюс
ДЕЙСТВИЕ в родительном падеже из per-feature namespace. Рендерится на клиенте.

Было (inline-литерал в `*.tsx`):

```tsx
{!state.success && state.code === "forbidden" && (
  <p className="text-sm text-red-600">У вас нет прав на отправку push-уведомлений.</p>
)}
```

Стало:

```tsx
import { useT } from "@/i18n/client";
const tErrors = useT("errors");
const tPrefs = useT("preferences"); // per-feature namespace слайса
// …
{!state.success && state.code === "forbidden" && (
  <p className="text-sm text-red-600">
    {tErrors("forbiddenAction", { action: tPrefs("pushSendAction") })}
  </p>
)}
```

Ключи:

- `errors.forbiddenAction` / `errors.forbiddenGeneric` / `errors.accountRestricted`
  / `errors.forbiddenTitle` / `errors.failureTitle` — уже в каталоге.
- Действие («отправку push-уведомлений») — per-feature ключ (`preferences.pushSendAction`).

#### Общий error-feedback seam — СДЕЛАНО (foundation-PR `feat(i18n): localize error-feedback seam`)

`src/utils/action-message.ts` / `action-toast.ts` / `src/components/ui/form-feedback.tsx`
БОЛЬШЕ не держат русский литерал «У вас нет прав на …». Все ~30 слайсов-вызывателей
оказались `"use client"`, поэтому итоговый паттерн:

- **`FormFeedback`** (UI-kit) стал `"use client"`-компонентом и сам тянет
  `useT("errors")`, применяя шаблон `errors.forbiddenAction` к пропу `forbiddenAction`.
  Вызыватель передаёт УЖЕ-локализованное действие (`forbiddenAction={t("createAction")}`)
  — сигнатура пропа не изменилась, новые callsites просто дают `t(...)` вместо литерала.
- **`actionErrorMessage` / `toastActionError`** — это утилиты (хуки нельзя), поэтому
  принимают первым/вторым аргументом `tErrors: ErrorsT`. Клиент-вызыватель добавляет
  `const tErrors = useT("errors")` и прокидывает его:
  `toastActionError(toast, tErrors, result, { action: t("deleteAction") })`. Шаблон,
  `forbiddenTitle`-/`failureTitle`-дефолты резолвятся из namespace `errors`
  (`forbiddenTitle`/`failureTitle`); опц. `opts.forbiddenTitle`/`opts.failureTitle`
  переопределяют их уже-локализованной строкой.
- **Тип `ErrorsT`** живёт в client-фасаде `@/i18n/client` (зеркало server-only
  `NamespaceT<"errors">`), импортится как `type` → Guardrail 5 не нарушается, директива
  `"use client"` не «протекает» в утилиты.
- **Тесты**: фабрика `makeErrorsT()` (`src/test/errors-t.ts`) строит `ErrorsT` из
  реального ru-каталога `errors` (юнит-тесты seam без next-intl-провайдера); тесты
  компонентов, рендерящих `FormFeedback`, мокают `@/i18n/client` на эту фабрику.

Новые слайсы: для toast — `useT("errors")` + проброс `tErrors`; для форм —
`forbiddenAction={t("<feature>Action>")}`. Действие — per-feature ключ в родительном
падеже (напр. `documents.createAction`).

## Подводные камни (для механических батчей)

- **SUSPENDED-без-текста = поведенческая регрессия.** Если слайс рендерит сырой
  `state.error` на ветке `code === "forbidden"`, то после миграции api-error
  suspended-кейс без текста с бэка даёт `"Forbidden: status"` вместо прежнего
  «Аккаунт ограничен.» (общий seam ещё не локализован). Поэтому на forbidden-ветке
  НЕ печатай сырой `state.error` — рендери клиентом `useT("errors")`:
  `forbiddenGeneric` (нет прав) / `accountRestricted` (suspended). См. Case 3.
- **Никогда не переиспользуй строку-ключ каталога как legacy-текст в
  `ApiErrorMessages`.** `isErrorKey` отличает новый канал от легаси по «есть ли
  такая строка среди ключей `errors`». Если легаси-значение случайно совпадёт с
  ключом каталога — оно будет молча переведено вместо проброса. Легаси-тексты —
  всегда человеческие фразы, не короткие ключи.
- **EN-переводы — машинные, требуют вычитки** носителем позже; не считать их
  финальными.

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

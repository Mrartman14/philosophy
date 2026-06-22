# Schema-sync hardening + usage-tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подтянуть фронт под перегенерённый `src/api/schema.ts`: снять обходные касты, починить фоллаут ужесточённых типов, добавить дружелюбное сообщение для новых `413`, и интегрировать новую ручку usage-tracking PAT (тогл + колонки).

**Architecture:** Точечное устрожение по существующим паттернам слайсов + одна новая UX-поверхность на `/me/tokens`, смоделированная на `statistics/history-tracking-toggle`. Ядро обработки ошибок не меняется — только расширяется `DEFAULT_MESSAGES`.

**Tech Stack:** Next.js (App Router, RSC + server actions), TypeScript (`exactOptionalPropertyTypes: true`), openapi-fetch + openapi-typescript, Zod, next-intl за фасадом `@/i18n`, vitest, pnpm.

## Global Constraints

- **Пакетный менеджер — только `pnpm`** (npm ломает тулчейн). Команды: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- **`exactOptionalPropertyTypes: true`** — не присваивать `undefined` в optional-поля; исключать ключ спредом `...(cond ? { k } : {})`.
- **i18n только через фасад `@/i18n`** (Guardrail 5): сообщения — ключи namespace, не литералы. `ru/*.ts` и `en/*.ts` держат паритет ключей (`satisfies Messages`) — добавлять ключ в ОБА файла.
- **RBAC:** в server actions — `requireCapability`/доменный гейт; в UI — `canX()` boolean пропом.
- **`src/api/schema.ts` НЕ редактировать** — он уже перегенерён пользователем (frozen-зона).
- **Правила параллельной работы (AGENTS.md):** никаких `git stash`/`reset`/`checkout .`/`clean`; `git add` — только свои файлы по имени, НЕ `git add -A`/`.`.
- **Чужой код не трогать:** `src/components/ast-merge/*` даёт 17 typecheck-ошибок — это параллельная инициатива conflict-merge (`word-diff.ts` на `noUncheckedIndexedAccess`), НЕ наш фоллаут. Done-bar их исключает.
- **Гейты PR:** `pnpm lint && pnpm test` зелёные. Полный `pnpm typecheck`/`pnpm build` останутся красными, пока другой агент не починит `ast-merge/*` — свою часть верифицируем typecheck-дельтой (`pnpm typecheck 2>&1 | grep -v ast-merge` пусто).
- **Коммиты:** на текущей ветке (проект ведёт параллельную работу на `main`); сообщение оканчивать строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Ведро 1 — Устрожение типов

### Task 1: Снять `as never` на `PATCH /api/me/preferences` (3 места)

Тело PATCH теперь типизировано схемой как `preference.UpdatePreferencesRequest`
(`{ appearance?: AppearancePatch, locale?: "system"|"ru"|"en", reading_mode?: "full"|"focused" }`).
Касты `as never` и сопровождающие их «комментарии-объяснения почему cast» устарели — снять.

**Files:**
- Modify: `src/features/preferences/actions.ts` (функция `updatePreferences`)
- Modify: `src/components/appearance/persist-appearance.ts`
- Modify: `src/i18n/persist-locale.ts`

- [ ] **Step 1: `preferences/actions.ts` — снять cast в `updatePreferences`**

Заменить блок (комментарий + вызов) на:

```ts
  // PATCH-body типизирован схемой как preference.UpdatePreferencesRequest
  // (regen 2026-06-20): partial appearance/locale/reading_mode. Cast `as never`
  // снят — тело проверяется типом.
  const { data, error } = await api.PATCH("/api/me/preferences", {
    body: { reading_mode: input.reading_mode },
  });
```

(`input.reading_mode` из `PreferencesUpdateSchema = z.object({ reading_mode: z.enum(READING_MODES) })` — тип `"full"|"focused"`, не undefined.)

- [ ] **Step 2: `persist-appearance.ts` — уточнить тип payload и снять cast**

Заменить алиас типа:

```ts
type AppearancePayload = components["schemas"]["preference.AppearancePatch"];
```

Заменить блок PATCH (комментарий + вызов) на:

```ts
    // PATCH body типизирован через preference.UpdatePreferencesRequest (regen
    // 2026-06-20): appearance — частичный preference.AppearancePatch. Cast снят.
    // Contrast "auto" по-прежнему опускается (AppearancePatch.contrast = normal|high).
    await api.PATCH("/api/me/preferences", {
      body: { appearance: toAppearancePayload(appearance) },
    });
```

(`toAppearancePayload` строит объект с always-present `theme/density/font/text_size` + условный `contrast` — удовлетворяет `AppearancePatch`.)

- [ ] **Step 3: `persist-locale.ts` — снять cast**

Заменить блок PATCH на:

```ts
    // PATCH body типизирован через preference.UpdatePreferencesRequest (regen
    // 2026-06-20): locale = "system" | "ru" | "en". Cast снят.
    await api.PATCH("/api/me/preferences", { body: { locale } });
```

- [ ] **Step 4: Проверить типы по трём файлам**

Run: `pnpm typecheck 2>&1 | grep -E "persist-appearance|persist-locale|preferences/actions" || echo "CLEAN"`
Expected: `CLEAN` (никаких ошибок в этих файлах).

Если падает на `persist-appearance` (тип `Appearance` шире `AppearancePatch`) — значит FE-тип `Appearance` (`./appearance-cookie`) имеет значение вне union'а схемы; это реальный дрейф, выровнять FE-тип, не кастить обратно.

- [ ] **Step 5: Прогнать тесты и линт**

Run: `pnpm test src/features/preferences && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/preferences/actions.ts src/components/appearance/persist-appearance.ts src/i18n/persist-locale.ts
git commit -m "$(cat <<'EOF'
refactor(preferences): drop `as never` on PATCH /me/preferences (typed body)

Schema regen typed the PATCH body as preference.UpdatePreferencesRequest;
remove the now-obsolete casts and their explanatory comments.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `enums.ts` — добавить `"map"` в `AUDIT_TARGET_TYPES`

`audit.TargetType` получил значение `"map"`; хелпер `enumValues<S["audit.TargetType"]>()`
требует ВСЕ члены союза (иначе «enum incomplete — missing: map»).

**Files:**
- Modify: `src/api/enums.ts:93-108`

**Interfaces:**
- Produces: `AUDIT_TARGET_TYPES` теперь содержит `"map"` (читают `audit/api.ts`, `audit/ui/audit-filter-form.tsx`).

- [ ] **Step 1: Подтвердить ошибку**

Run: `pnpm typecheck 2>&1 | grep "enums.ts"`
Expected: `src/api/enums.ts(96,3): error TS2554: Expected 2 arguments, but got 14.`

- [ ] **Step 2: Добавить `"map"` алфавитно (между `lecture` и `media`)**

В блоке `AUDIT_TARGET_TYPES` вставить строку `"map",` после `"lecture",`:

```ts
export const AUDIT_TARGET_TYPES = enumValues<S["audit.TargetType"]>()(
  "annotation",
  "banner",
  "canvas",
  "comment",
  "document",
  "event",
  "form",
  "glossary_term",
  "lecture",
  "map",
  "media",
  "push",
  "tag",
  "trail",
  "user",
);
```

- [ ] **Step 3: Проверить, что ошибка `enums.ts` ушла**

Run: `pnpm typecheck 2>&1 | grep "enums.ts" || echo "CLEAN"`
Expected: `CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add src/api/enums.ts
git commit -m "$(cat <<'EOF'
fix(audit): add "map" to AUDIT_TARGET_TYPES (schema regen)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `audit/api.ts` — выровнять `target_type` фильтра с эндпоинтом

Дрейф контракта бэка: общий `audit.TargetType` получил `"map"`, а query-параметр
`target_type` у `GET /api/admin/audit` — нет. Тип query-фильтра выводим из самого
эндпоинта (источник истины «по чему можно фильтровать»); `"map"` не пробрасываем
и не предлагаем в дропдауне.

**Files:**
- Modify: `src/features/audit/api.ts` (функция `getAuditLog`)
- Modify: `src/features/audit/ui/audit-filter-form.tsx` (`TARGET_TYPE_OPTIONS`)

- [ ] **Step 1: Подтвердить ошибку**

Run: `pnpm typecheck 2>&1 | grep "audit/api.ts"`
Expected: `src/features/audit/api.ts(64,17): error TS2375: ... Type '"map"' is not assignable ...`

- [ ] **Step 2: Вывести тип query из эндпоинта и скипнуть `"map"`**

В `src/features/audit/api.ts` добавить импорт `paths` к существующим импортам:

```ts
import type { paths } from "@/api/schema";
```

Заменить ручное объявление типа `query` и присваивание `target_type` внутри `getAuditLog`. Было:

```ts
    const query: {
      offset: number;
      limit: number;
      actor?: string;
      target_type?: AuditTargetType;
      target_id?: string;
      action?: string;
      from?: string;
      to?: string;
    } = { offset, limit };
    if (filter.actor) query.actor = filter.actor;
    if (filter.target_type) query.target_type = filter.target_type;
```

Стало:

```ts
    // Тип query — из самого эндпоинта (а не из общего audit.TargetType): это
    // источник истины «по чему фильтрует листинг». audit.TargetType шире
    // (содержит "map", т.к. записи МОГУТ указывать на карту), но фильтр на
    // беке "map" пока не принимает — контракт-дрейф, бэк-аск выдан.
    type AuditListQuery = NonNullable<
      paths["/api/admin/audit"]["get"]["parameters"]["query"]
    >;
    const query: AuditListQuery = { offset, limit };
    if (filter.actor) query.actor = filter.actor;
    if (filter.target_type && filter.target_type !== "map") {
      query.target_type = filter.target_type;
    }
```

(Гард `!== "map"` сужает `AuditTargetType` до `Exclude<…, "map">`, что совпадает с типом параметра эндпоинта.)

- [ ] **Step 3: Убрать `"map"` из опций фильтра в UI**

В `src/features/audit/ui/audit-filter-form.tsx` заменить генерацию `TARGET_TYPE_OPTIONS`:

```ts
  const TARGET_TYPE_OPTIONS = [
    { value: ALL_TYPES, label: t("filterAllTypes") },
    // "map" опущен: записи могут указывать на карту, но фильтр листинга на
    // беке его не принимает (контракт-дрейф). Вернуть, когда бэк выровняет enum.
    ...AUDIT_TARGET_TYPES.filter((type) => type !== "map").map((type) => ({
      value: type,
      label: type,
    })),
  ];
```

- [ ] **Step 4: Проверить типы и линт**

Run: `pnpm typecheck 2>&1 | grep "audit/" || echo "CLEAN"; pnpm lint`
Expected: `CLEAN` + lint PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/audit/api.ts src/features/audit/ui/audit-filter-form.tsx
git commit -m "$(cat <<'EOF'
fix(audit): derive list filter target_type from endpoint, skip "map"

audit.TargetType gained "map" but the list-filter enum didn't (backend
drift). Type the query from the endpoint params and omit "map" both
server-side and in the filter dropdown.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `forms/actions.ts` — типизировать `buildFieldsBody`, снять `as never`

`CreateFormRequest` ужесточил `fields`/`submission_mode`/`visibility`/`title` до
required. `buildFieldsBody(...) as never` + условный спред (делавший
`submission_mode`/`visibility` optional) больше не проходят.

**Files:**
- Modify: `src/features/forms/actions.ts` (`buildFieldsBody`, `createForm`, `updateForm`)

- [ ] **Step 1: Подтвердить ошибку**

Run: `pnpm typecheck 2>&1 | grep "forms/actions.ts"`
Expected: `src/features/forms/actions.ts(77,5): error TS2375: ... submission_mode ... required ...`

- [ ] **Step 2: Типизировать `buildFieldsBody`**

Добавить импорт типа схемы к существующим импортам:

```ts
import type { components } from "@/api/schema";
```

Заменить сигнатуру/тело `buildFieldsBody`:

```ts
type FieldType = components["schemas"]["form.FieldType"];
type CreateFieldRequest = components["schemas"]["form.CreateFieldRequest"];

function buildFieldsBody(
  fields: {
    type: FieldType;
    prompt: string;
    help_text?: string | undefined;
    required: boolean;
    sort_order: number;
    options?: string[] | undefined;
  }[],
): CreateFieldRequest[] {
  return fields.map((f) => ({
    type: f.type,
    prompt: f.prompt,
    required: f.required,
    sort_order: f.sort_order,
    ...(f.help_text ? { help_text: f.help_text } : {}),
    ...(f.options ? { options: f.options.map((label) => ({ label })) } : {}),
  }));
}
```

Если `input.fields[].type` не присваивается к `FieldType` (Zod `makeFieldSchema` отдаёт иной union) — выровнять `z.enum` в `forms/schemas.ts` под `form.FieldType`; cast не возвращать.

- [ ] **Step 3: Снять `as never` и присвоить required-поля напрямую в `createForm`**

Заменить тело `body` в `createForm`:

```ts
    body: {
      title: input.title,
      fields: buildFieldsBody(input.fields),
      // visibility/submission_mode гарантированы superRefine FormCreateSchema
      // (краснеют 422 на беке иначе) — у Zod тип optional, поэтому non-null.
      submission_mode: input.submission_mode!,
      visibility: input.visibility!,
      ...(input.description ? { description: input.description } : {}),
      ...(input.after_submit ? { after_submit: input.after_submit } : {}),
    },
```

- [ ] **Step 4: Снять `as never` в `updateForm`**

В `updateForm` `fields` остаётся optional у `UpdateFormRequest`, но `buildFieldsBody` теперь типизирован — убрать каст:

```ts
      fields: buildFieldsBody(payload.fields),
```

- [ ] **Step 5: Проверить типы и тесты форм**

Run: `pnpm typecheck 2>&1 | grep "forms/actions.ts" || echo "CLEAN"`
Expected: `CLEAN`.

Run: `pnpm test src/features/forms && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Проверить, что мой фоллаут исчерпан**

Run: `pnpm typecheck 2>&1 | grep -v "ast-merge" | grep "error TS" || echo "ONLY AST-MERGE LEFT"`
Expected: `ONLY AST-MERGE LEFT` (все 3 мои ошибки закрыты; остаются только чужие `ast-merge/*`).

- [ ] **Step 7: Commit**

```bash
git add src/features/forms/actions.ts
git commit -m "$(cat <<'EOF'
fix(forms): type buildFieldsBody, drop `as never` after CreateFormRequest tightening

Schema regen made fields/submission_mode/visibility/title required. Type
the field-body builder against form.CreateFieldRequest and pass the
superRefine-guaranteed mode/visibility directly.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Ведро 2 — Новые типы ошибок

### Task 5: Дружелюбное сообщение для `413` (REQUEST_BODY_TOO_LARGE / PAYLOAD_TOO_LARGE)

Бэк добавил `413` на множество ручек (создание комментария, поиск, контекст и др.).
Сейчас они падают в generic-фоллбек; добавить общий ключ в `DEFAULT_MESSAGES` + каталог.
canvas/annotations сохраняют свои entity-override (приоритетнее дефолта).

**Note (MAP_NOT_READY):** проверено — `/api/map` ВСЁ ЕЩЁ декларирует `503 MAP_NOT_READY`
(503 убрали с двух других админ-ручек), поэтому `getMap`-обработка
`response.status === 503 → reason "building"` в `semantic-map/api.ts` ЖИВА и корректна.
Изменений не требуется.

**Files:**
- Modify: `src/utils/api-error.ts` (`DEFAULT_MESSAGES`)
- Modify: `src/i18n/messages/ru/errors.ts`
- Modify: `src/i18n/messages/en/errors.ts`
- Test: `src/utils/api-error.test.ts`

- [ ] **Step 1: Добавить ключи в каталог `ru/errors.ts`**

Рядом с `CANVAS_PAYLOAD_TOO_LARGE` (строка ~79) добавить два общих ключа:

```ts
  REQUEST_BODY_TOO_LARGE: "Запрос слишком большой. Уменьшите содержимое и повторите.",
  PAYLOAD_TOO_LARGE: "Запрос слишком большой. Уменьшите содержимое и повторите.",
```

- [ ] **Step 2: Добавить те же ключи в `en/errors.ts`**

Рядом с `CANVAS_PAYLOAD_TOO_LARGE` (строка ~75):

```ts
  REQUEST_BODY_TOO_LARGE: "The request is too large. Reduce the content and try again.",
  PAYLOAD_TOO_LARGE: "The request is too large. Reduce the content and try again.",
```

- [ ] **Step 3: Написать падающий тест в `api-error.test.ts`**

Добавить новый describe-блок в конец файла:

```ts
describe("rethrowApiError — 413 (несут ключ каталога)", () => {
  it("REQUEST_BODY_TOO_LARGE → ApiMessageError('REQUEST_BODY_TOO_LARGE')", () => {
    const err = caught(() => rethrowApiError({ code: "REQUEST_BODY_TOO_LARGE" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("REQUEST_BODY_TOO_LARGE");
  });

  it("PAYLOAD_TOO_LARGE → ApiMessageError('PAYLOAD_TOO_LARGE')", () => {
    const err = caught(() => rethrowApiError({ code: "PAYLOAD_TOO_LARGE" }));
    expect(err).toBeInstanceOf(ApiMessageError);
    expect((err as ApiMessageError).messageKey).toBe("PAYLOAD_TOO_LARGE");
  });

  it("слайс-override приоритетнее общего ключа", () => {
    const err = caught(() =>
      rethrowApiError(
        { code: "REQUEST_BODY_TOO_LARGE" },
        { REQUEST_BODY_TOO_LARGE: "CANVAS_PAYLOAD_TOO_LARGE" },
      ),
    );
    expect((err as ApiMessageError).messageKey).toBe("CANVAS_PAYLOAD_TOO_LARGE");
  });
});
```

- [ ] **Step 4: Запустить тест — убедиться, что падает**

Run: `pnpm test src/utils/api-error.test.ts`
Expected: FAIL — первые два кейса дают `serverError`/текст вместо ключа (код ещё не в `DEFAULT_MESSAGES`).

- [ ] **Step 5: Добавить коды в `DEFAULT_MESSAGES`**

В `src/utils/api-error.ts` в объект `DEFAULT_MESSAGES` добавить (после idempotency-ключей):

```ts
  // 413 — общий дефолт для всех ручек с лимитом тела (создание комментария,
  // поиск/контекст и др.). Слайс может переопределить entity-ключом
  // (canvas → CANVAS_PAYLOAD_TOO_LARGE, annotation → ANNOTATION_REQUEST_BODY_TOO_LARGE).
  REQUEST_BODY_TOO_LARGE: "REQUEST_BODY_TOO_LARGE",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
```

- [ ] **Step 6: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/utils/api-error.test.ts`
Expected: PASS (все кейсы, включая приоритет override).

- [ ] **Step 7: Линт + проверка i18n-паритета**

Run: `pnpm lint && pnpm typecheck 2>&1 | grep -E "errors.ts|api-error" || echo "CLEAN"`
Expected: lint PASS + `CLEAN` (паритет ключей ru/en форсится `satisfies Messages`).

- [ ] **Step 8: Commit**

```bash
git add src/utils/api-error.ts src/utils/api-error.test.ts src/i18n/messages/ru/errors.ts src/i18n/messages/en/errors.ts
git commit -m "$(cat <<'EOF'
feat(errors): friendly message for 413 REQUEST_BODY_TOO_LARGE/PAYLOAD_TOO_LARGE

Backend added 413 to many endpoints (comment create, search, context).
Map both codes to a generic catalog key; slice overrides still win.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Ведро 3 — usage-tracking (фича)

### Task 6: Фундамент — типы, Zod-схема, i18n-ключи

**Files:**
- Modify: `src/features/tokens/types.ts`
- Modify: `src/features/tokens/schemas.ts`
- Modify: `src/i18n/messages/ru/tokens.ts`
- Modify: `src/i18n/messages/en/tokens.ts`

**Interfaces:**
- Produces: типы `UsageTracking`, `SetUsageTrackingRequest`; схема `UsageTrackingSchema`; i18n-ключи `usageTracking*`, `colLastUsed`, `colRequests` (потребляют Tasks 7–10).

- [ ] **Step 1: Добавить типы в `tokens/types.ts`**

В конец файла:

```ts
/** Состояние трекинга использования PAT (GET/PUT /api/me/tokens/usage-tracking). */
export type UsageTracking = components["schemas"]["pat.UsageTracking"];

/** Тело PUT /api/me/tokens/usage-tracking. */
export type SetUsageTrackingRequest =
  components["schemas"]["pat.setUsageTrackingRequest"];
```

- [ ] **Step 2: Добавить Zod-схему в `tokens/schemas.ts`**

В конец файла (перед/после `CreateTokenInput` — порядок не важен):

```ts
/** PUT /api/me/tokens/usage-tracking — булево enabled (без сообщений → const). */
export const UsageTrackingSchema = z.boolean();
```

- [ ] **Step 3: Добавить i18n-ключи в `ru/tokens.ts`**

Внутри объекта `tokens` (плоские ключи, как существующие) добавить секцию:

```ts
  // --- Трекинг использования (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "Трекинг использования",
  usageTrackingIntro:
    "Когда включён, для каждого токена записываются число запросов и время последнего использования.",
  usageTrackingEnabledStatus: "Трекинг включён.",
  usageTrackingDisabledStatus: "Трекинг выключен.",
  usageTrackingEnableButton: "Включить трекинг",
  usageTrackingDisableButton: "Выключить трекинг",
  usageTrackingDisableDialogTitle: "Выключить трекинг использования?",
  usageTrackingDisableDialogDescription:
    "Все накопленные счётчики (число запросов и время последнего обращения) будут удалены безвозвратно.",
  usageTrackingDisableConfirmLabel: "Выключить и удалить",
  usageTrackingSavedTitle: "Сохранено",
  usageTrackingEnabledToast: "Трекинг использования включён.",
  usageTrackingDisabledToast: "Трекинг выключен, счётчики удалены.",
  usageTrackingManageAction: "изменить настройки трекинга",
  // колонки таблицы токенов
  colLastUsed: "Последнее использование",
  colRequests: "Запросов",
```

- [ ] **Step 4: Добавить те же ключи в `en/tokens.ts` (паритет)**

```ts
  // --- Usage tracking (usage-tracking-toggle.tsx) ---
  usageTrackingHeading: "Usage tracking",
  usageTrackingIntro:
    "When enabled, each token records its request count and last-used time.",
  usageTrackingEnabledStatus: "Tracking is enabled.",
  usageTrackingDisabledStatus: "Tracking is disabled.",
  usageTrackingEnableButton: "Enable tracking",
  usageTrackingDisableButton: "Disable tracking",
  usageTrackingDisableDialogTitle: "Disable usage tracking?",
  usageTrackingDisableDialogDescription:
    "All accumulated counters (request count and last-used time) will be deleted permanently.",
  usageTrackingDisableConfirmLabel: "Disable and delete",
  usageTrackingSavedTitle: "Saved",
  usageTrackingEnabledToast: "Usage tracking enabled.",
  usageTrackingDisabledToast: "Tracking disabled, counters deleted.",
  usageTrackingManageAction: "change tracking settings",
  // token table columns
  colLastUsed: "Last used",
  colRequests: "Requests",
```

- [ ] **Step 5: Проверить типы и паритет**

Run: `pnpm typecheck 2>&1 | grep -E "tokens/types|tokens/schemas|tokens.ts" || echo "CLEAN"`
Expected: `CLEAN` (если паритет ru/en нарушен — `satisfies Messages` подсветит недостающий ключ).

- [ ] **Step 6: Commit**

```bash
git add src/features/tokens/types.ts src/features/tokens/schemas.ts src/i18n/messages/ru/tokens.ts src/i18n/messages/en/tokens.ts
git commit -m "$(cat <<'EOF'
feat(tokens): usage-tracking foundation (types, schema, i18n keys)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Data-слой — `getUsageTracking` + `setUsageTracking` + тест

**Files:**
- Modify: `src/features/tokens/api.ts`
- Modify: `src/features/tokens/actions.ts`
- Test: `src/features/tokens/set-usage-tracking.test.ts` (create)

**Interfaces:**
- Consumes: `UsageTracking` (Task 6), `UsageTrackingSchema` (Task 6), `canManageTokens`, `Tags.TOKENS`.
- Produces: `getUsageTracking(): Promise<UsageTracking>`; `setUsageTracking(raw: unknown): Promise<ActionResult<true>>`.

- [ ] **Step 1: Добавить `getUsageTracking` в `tokens/api.ts`**

Расширить импорт типов и добавить функцию:

```ts
import type { PatToken, UsageTracking } from "./types";

/**
 * Состояние трекинга использования PAT текущего актора.
 * GET /api/me/tokens/usage-tracking → httputil.Response & { data: pat.UsageTracking }.
 * Пер-юзерные данные — React.cache дедуплицирует в рамках запроса.
 */
export const getUsageTracking = cache(async (): Promise<UsageTracking> => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/api/me/tokens/usage-tracking");
  if (error) {
    throw new Error(error.error ?? (await getT("tokens"))("api.loadFailed"));
  }
  return unwrap<UsageTracking>(data) ?? { tracking_enabled: false };
});
```

- [ ] **Step 2: Добавить `setUsageTracking` в `tokens/actions.ts`**

Расширить импорт схем и добавить action (после `revokeToken`):

```ts
import { makeCreateTokenSchema, UsageTrackingSchema } from "./schemas";

/**
 * Включить/выключить трекинг использования PAT. PUT /api/me/tokens/usage-tracking.
 * Выключение на бэке безвозвратно удаляет накопленные счётчики (purge) —
 * предупреждение в UI (ConfirmDialog в usage-tracking-toggle).
 */
export const setUsageTracking = createAction(
  async (raw: unknown): Promise<true> => {
    const me = await getMe();
    if (!canManageTokens(me)) throw new ForbiddenError(me ? "status" : "guest");
    const enabled = UsageTrackingSchema.parse(raw);
    const api = await createApiClient();
    const { error } = await api.PUT("/api/me/tokens/usage-tracking", {
      body: { enabled },
    });
    if (error) rethrowApiError(error);
    revalidateEntity(Tags.TOKENS);
    return true;
  },
  "setUsageTracking",
);
```

- [ ] **Step 3: Написать падающий тест `set-usage-tracking.test.ts`**

Create `src/features/tokens/set-usage-tracking.test.ts` (паттерн из `comments/update-comment-blocks-optlock.test.ts`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ PUT: put }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("./permissions", () => ({ canManageTokens: () => true }));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { setUsageTracking } from "./actions";

describe("setUsageTracking", () => {
  beforeEach(() => {
    put.mockReset();
    put.mockResolvedValue({ data: { data: { tracking_enabled: true } }, error: undefined });
  });

  it("шлёт PUT с { enabled: true } при включении", async () => {
    const result = await setUsageTracking(true);
    expect(result.success).toBe(true);
    expect(put).toHaveBeenCalledWith("/api/me/tokens/usage-tracking", {
      body: { enabled: true },
    });
  });

  it("шлёт PUT с { enabled: false } при выключении (purge)", async () => {
    await setUsageTracking(false);
    expect(put).toHaveBeenCalledWith("/api/me/tokens/usage-tracking", {
      body: { enabled: false },
    });
  });
});
```

- [ ] **Step 4: Запустить тест**

Run: `pnpm test src/features/tokens/set-usage-tracking.test.ts`
Expected: PASS (action уже реализован в Step 2 — тест зелёный сразу; если красный из-за формы вызова — починить action, не тест).

- [ ] **Step 5: Проверить типы и линт**

Run: `pnpm typecheck 2>&1 | grep -E "tokens/api|tokens/actions" || echo "CLEAN"; pnpm lint`
Expected: `CLEAN` + lint PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/tokens/api.ts src/features/tokens/actions.ts src/features/tokens/set-usage-tracking.test.ts
git commit -m "$(cat <<'EOF'
feat(tokens): getUsageTracking + setUsageTracking data layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: UI — компонент `usage-tracking-toggle.tsx`

Смоделирован на `statistics/ui/history-tracking-toggle.tsx`: optimistic local
state, ConfirmDialog только при выключении (деструктивный purge).

**Files:**
- Create: `src/features/tokens/ui/usage-tracking-toggle.tsx`

**Interfaces:**
- Consumes: `setUsageTracking` (Task 7), i18n-ключи `usageTracking*` (Task 6).
- Produces: `UsageTrackingToggle({ initialEnabled, canManage })`.

- [ ] **Step 1: Создать компонент**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { useT } from "@/i18n/client";
import { toastActionError } from "@/utils/action-toast";

import { setUsageTracking } from "../actions";

interface Props {
  initialEnabled: boolean;
  /** canManageTokens(me) со страницы (server component). */
  canManage: boolean;
}

export function UsageTrackingToggle({ initialEnabled, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const t = useT("tokens");
  const tErrors = useT("errors");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    try {
      const result = await setUsageTracking(next);
      if (!result.success) {
        toastActionError(toast, tErrors, result, {
          action: t("usageTrackingManageAction"),
        });
        return;
      }
      setEnabled(next);
      toast.add({
        title: t("usageTrackingSavedTitle"),
        description: next
          ? t("usageTrackingEnabledToast")
          : t("usageTrackingDisabledToast"),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-sm font-semibold">{t("usageTrackingHeading")}</h2>
      <p className="text-xs text-(--color-fg-muted)">{t("usageTrackingIntro")}</p>
      {enabled ? (
        <>
          <p className="text-sm">{t("usageTrackingEnabledStatus")}</p>
          <ConfirmDialog
            destructive
            trigger={
              <Button
                variant="secondary"
                className="self-start"
                disabled={pending || !canManage}
              >
                {t("usageTrackingDisableButton")}
              </Button>
            }
            title={t("usageTrackingDisableDialogTitle")}
            description={t("usageTrackingDisableDialogDescription")}
            confirmLabel={t("usageTrackingDisableConfirmLabel")}
            onConfirm={() => apply(false)}
          />
        </>
      ) : (
        <>
          <p className="text-sm">{t("usageTrackingDisabledStatus")}</p>
          <Button
            className="self-start"
            disabled={pending || !canManage}
            onClick={() => {
              void apply(true);
            }}
          >
            {t("usageTrackingEnableButton")}
          </Button>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Проверить типы и линт**

Run: `pnpm typecheck 2>&1 | grep "usage-tracking-toggle" || echo "CLEAN"; pnpm lint`
Expected: `CLEAN` + lint PASS. (Презентационные компоненты в слайсе юнит-тестами не покрываются — ср. `token-list.tsx`, `history-tracking-toggle.tsx` без тестов.)

- [ ] **Step 3: Commit**

```bash
git add src/features/tokens/ui/usage-tracking-toggle.tsx
git commit -m "$(cat <<'EOF'
feat(tokens): UsageTrackingToggle (confirm purge on disable)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: UI — колонки `last_used_at` / `request_count` в `token-list.tsx`

**Files:**
- Modify: `src/features/tokens/ui/token-list.tsx`

- [ ] **Step 1: Добавить форматтер последнего использования**

Рядом с `fmtCreated`/`fmtExpires` добавить:

```ts
  function fmtLastUsed(sec?: number): string {
    const d = unixSecToDate(sec);
    return d ? fmt.dateTime(d, DATE_FMT) : "—";
  }
```

- [ ] **Step 2: Добавить заголовки колонок**

В `<Thead><Tr>` после `<Th>{t("colExpires")}</Th>` вставить:

```tsx
          <Th>{t("colLastUsed")}</Th>
          <Th>{t("colRequests")}</Th>
```

- [ ] **Step 3: Добавить ячейки в строку**

В теле строки (`tokens.map`) после `<Td>` с `fmtExpires(...)` (и `expiryNote`) вставить:

```tsx
              <Td className="whitespace-nowrap">{fmtLastUsed(token.last_used_at)}</Td>
              <Td className="tabular-nums">{token.request_count ?? "—"}</Td>
```

(`request_count` — `?? "—"`, а не `||`: реальный 0 запросов показывается «0», не «—».)

- [ ] **Step 4: Проверить типы и линт**

Run: `pnpm typecheck 2>&1 | grep "token-list" || echo "CLEAN"; pnpm lint`
Expected: `CLEAN` + lint PASS (`token.last_used_at`/`request_count` теперь в `pat.Token`).

- [ ] **Step 5: Commit**

```bash
git add src/features/tokens/ui/token-list.tsx
git commit -m "$(cat <<'EOF'
feat(tokens): show last_used_at / request_count columns

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wiring — страница + менеджер + barrel

**Files:**
- Modify: `src/features/tokens/index.ts`
- Modify: `src/features/tokens/ui/tokens-manager.tsx`
- Modify: `src/app/me/tokens/page.tsx`

**Interfaces:**
- Consumes: `getUsageTracking` (Task 7), `UsageTrackingToggle` (Task 8).

- [ ] **Step 1: Экспортировать `getUsageTracking` из barrel**

В `src/features/tokens/index.ts` заменить строку экспорта api:

```ts
export { getTokens, getUsageTracking } from "./api";
```

- [ ] **Step 2: Принять `trackingEnabled` в `TokensManager` и отрендерить тогл**

В `tokens-manager.tsx`: добавить импорт

```ts
import { UsageTrackingToggle } from "./usage-tracking-toggle";
```

Расширить `Props` и деструктуризацию:

```ts
interface Props {
  initialTokens: PatToken[];
  canManage: boolean;
  /** Абсолютный URL MCP-эндпоинта для блока «как подключить». */
  mcpUrl: string;
  /** pat.UsageTracking.tracking_enabled со страницы. */
  trackingEnabled: boolean;
}
```

```ts
export function TokensManager({ initialTokens, canManage, mcpUrl, trackingEnabled }: Props) {
```

Перед `<TokenList ... />` (в конце JSX) вставить секцию тогла (гейт как у формы создания):

```tsx
      {canManage && (
        <UsageTrackingToggle initialEnabled={trackingEnabled} canManage={canManage} />
      )}

      <TokenList tokens={initialTokens} canManage={canManage} />
```

- [ ] **Step 3: Загрузить состояние трекинга на странице и прокинуть проп**

В `src/app/me/tokens/page.tsx` обновить импорт и загрузку:

```ts
import { canManageTokens, getTokens, getUsageTracking, TokensManager } from "@/features/tokens";
```

Заменить загрузку токенов на параллельную:

```ts
  const [tokens, usageTracking] = await Promise.all([getTokens(), getUsageTracking()]);
```

Расширить пропы `TokensManager`:

```tsx
      <TokensManager
        initialTokens={tokens}
        canManage={canManageTokens(me)}
        mcpUrl={mcpUrl}
        trackingEnabled={usageTracking.tracking_enabled ?? false}
      />
```

- [ ] **Step 4: Проверить типы, линт, тесты слайса**

Run: `pnpm typecheck 2>&1 | grep -E "tokens|app/me/tokens" || echo "CLEAN"`
Expected: `CLEAN`.

Run: `pnpm test src/features/tokens && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Финальная проверка — только чужой фоллаут остаётся**

Run: `pnpm typecheck 2>&1 | grep -v "ast-merge" | grep "error TS" || echo "ONLY AST-MERGE LEFT"`
Expected: `ONLY AST-MERGE LEFT`.

Run: `pnpm test`
Expected: PASS (вся сюита).

- [ ] **Step 6: Commit**

```bash
git add src/features/tokens/index.ts src/features/tokens/ui/tokens-manager.tsx src/app/me/tokens/page.tsx
git commit -m "$(cat <<'EOF'
feat(tokens): wire usage-tracking toggle into /me/tokens page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Бэк-аски (выдать пользователю по завершении)

1. Выровнять enum query-параметра `target_type` у `GET /api/admin/audit` с
   `audit.TargetType` (добавить `"map"`), если карты должны быть фильтруемы в
   админ-аудите. До этого FE не предлагает и не шлёт `"map"` как фильтр (Task 3).

## Замечание о done-bar

Полный `pnpm build`/`pnpm typecheck` зелёными НЕ станут, пока параллельный агент не
починит `src/components/ast-merge/*` (17 пре-существующих ошибок, инициатива
conflict-merge). Наша часть верифицируется:
`pnpm typecheck 2>&1 | grep -v ast-merge | grep "error TS"` → пусто, `pnpm lint` и
`pnpm test` → зелёные. Не выдавать «build зелёный» в отчёте о готовности.

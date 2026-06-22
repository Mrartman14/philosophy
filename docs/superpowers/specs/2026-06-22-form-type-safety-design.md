# Типобезопасность форм: связь `name` ↔ ключи схемы (итерация 1)

**Дата:** 2026-06-22
**Статус:** дизайн одобрен, готов к написанию плана
**Слой:** foundation (kit `src/components/ui/*` + конвенция экспорта типов в слайсах)

---

## 1. Проблема

Сейчас связь «Zod-схема ↔ форма» держится на строках, а не на типах. Три «нестрогих» шва:

1. **`name` не привязан к ключам схемы.** `FormField` ([form-field.tsx:9](../../../src/components/ui/form-field.tsx#L9)) и контролы (`TextInput`/`Select`/`ColorInput`) принимают `name: string`. Опечатка (`name="typ"` вместо `type`) не ловится типами — в рантайме поле приедет «отсутствующим», ошибка ляжет под несуществующий ключ и молча исчезнет.
2. **`name` дублируется** на `FormField` и на самом контроле — два места руками, рассинхрон ничем не ловится.
3. **`errors` / `fieldErrors` — `Record<string, string>`** ([form.tsx:7](../../../src/components/ui/form.tsx#L7), [create-action.ts:26](../../../src/utils/create-action.ts#L26)): ключи произвольные строки, не привязаны к схеме.

Типобезопасна только **граница экшен → API** (`z.infer` + openapi-fetch). Граница **форма → экшен** — целиком строковая, проверяется лишь в рантайме (а опечатка `name` — вообще никак).

### Что строго НЕ так (не воспроизводить наивные решения)

- **Нельзя тащить рантайм-схему в клиент.** Все 21 `schemas.ts` помечены `import "server-only"` и завязаны на i18n (~85 фабрик `makeXSchema(t)`, сообщения резолвятся в рантайме). G3/G4 это форсят.
- **Сквозной дженерик через `ActionResult` отвергнут** (рассмотрен и отклонён): для вложенных схем `fieldErrors`-ключ — точечный путь (`items.2.label`), который `keyof Input` не выражает (нужна DeepKeys-машинерия); `TInput` нельзя инферить (схема выбирается внутри тела экшена) → ручное указание на 46 call-site с риском дрейфа; пачкает общий `create-action.ts`, используемый и не-формами; почти нулевой выигрыш над типизацией на границе формы.

---

## 2. Выбор подхода (из ресёрча 2026-06-22)

Индустриальный обзор (Conform / TanStack Form / React Hook Form / нативные Server Actions / Standard Schema) дал:

- **Conform** — единственная библиотека, дающая `name` из схемы И сохраняющая progressive enhancement (FormData-first, нативные Server Actions). Индустриальный выбор №1 для стека «Server Actions + FormData + PE».
- **TanStack Form / RHF** — client-state-first, слабее по works-without-JS; у TanStack `name` выводится из `defaultValues`, не из схемы (не тот SSOT). Отклонены для этого проекта.

**Решение проекта — кастомный тонкий слой, НЕ библиотека.** Обоснование: главный козырь Conform (та же рантайм-схема на клиенте для ре-валидации) у нас заблокирован server-only + i18n — мы использовали бы ~половину Conform в server-only-режиме. Остаточная дельта над кастомным слоем не перевешивает риск single-maintainer-зависимости и примирение с моделью ошибок Base UI Field на 46 формах. Существующая архитектура (Server Actions + FormData + Zod + PE) — туда, куда движется платформа; пробел узкий и чинится хирургически.

Conform остаётся задокументированным запасным вариантом, если в будущем понадобится богатое моделирование вложенных массивов из плоской FormData.

---

## 3. Ограничения проекта, формирующие дизайн

Из инвентаризации форм (46 форм в 21 слайсе, 180 использований `FormField`):

- **Все схемы server-only + i18n-фабрики** → рантайм в клиент нельзя; но `keyof z.input<schema>` — это **тип**, он стирается при компиляции → `import type` легален.
- **13 форм — JSON-острова**: multi-value/сложные данные проталкиваются через `JSON.stringify` в hidden-инпут (AST-блоки, `tag_ids[]`, `payload`, `answers`) + `.transform()` в схеме. 94 контролируемых контрола.
- **`forms/**` — динамический конструктор форм**: поля задаются в рантайме, вся структура в одном `payload`-JSON. Рантайм-валидируемый остров by design — вне охвата compile-time-слоя.
- **Файловые загрузки** (`document-upload`, `media-upload`, `lecture-cover`); Base UI `Select` сам генерит скрытый input.
- **G7** запрещает нативные `form`/`select`/`button` вне kit, но **`<input type="hidden">` разрешён** (используется повсеместно). **G8** закрывает «вид» kit-контролов.

---

## 4. Дизайн

### 4.1. Охват итерации 1

- ✅ Типизация `name` ↔ `keyof z.input<schema>` (обе точки: `FormField` и контрол).
- ✅ Типизация `errors` / `fieldErrors` на границе формы.
- ✅ **Required-enforcement**: если ключ required в `z.input`, `required` на `FormField` становится обязательным пропом (убивает дрейф «схема required, а звёздочки `*` в UI нет»).
- ⛔ Дедупликация `name` (Field впрыскивает имя в контрол) — итерация 2.

### 4.2. Публичный API: `createTypedForm<T>()`

Factory в kit, связанный с **input-типом** схемы, биндит `T` один раз. Рантайм — identity + каст.

```tsx
"use client";
import type { BannerCreateFormInput } from "../schemas";   // z.input, стирается компилятором
import { Form, createTypedForm, TextInput, ColorInput, Select, Stack } from "@/components/ui";

const { Field, f, errors } = createTypedForm<BannerCreateFormInput>();

<Form action={action} errors={errors(state)}>
  <Stack>
    <input type="hidden" name={f("dismissible")} value={…} />        {/* name типизирован */}

    <Field name="background_color" label={t("fieldColor")} required>  {/* required ОБЯЗАТЕЛЕН по типу */}
      <ColorInput name={f("background_color")} defaultValue="#336699" />
    </Field>

    <Field name="start_at" label={t("fieldStartAt")} required>
      <TextInput name={f("start_at")} type="datetime-local" />
    </Field>

    <Field name="end_at" label={t("fieldEndAt")}>                     {/* optional-ключ: required НЕ требуется */}
      <TextInput name={f("end_at")} type="datetime-local" />
    </Field>

    {errors(state)._form && <p role="alert">{errors(state)._form}</p>}
  </Stack>
</Form>
```

**Три экспорта:**

| Экспорт | Что | Решает шов |
| --- | --- | --- |
| **`Field`** | `FormField`, связанный с `T`: `name` ⊂ `keyof T`, `required` обязателен для required-ключей | 1 (name) + required↔схема |
| **`f`** | `keyof T → string` для контролов и hidden-инпутов | 2 (вторая точка name) |
| **`errors`** | `Partial<Record<keyof T, string>> & { _form?: string }` для `<Form errors>` и ручного чтения | 3 (errors) |

### 4.3. Машинерия required-enforcement (тип)

```ts
type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T];
// boolean-ключи исключаем: required boolean ≠ «галка обязана быть нажата»
type Enforced<T> = { [K in RequiredKeys<T>]: T[K] extends boolean ? never : K }[RequiredKeys<T>];

type TypedFieldProps<T, K extends keyof T & string> = {
  name: K; label: ReactNode; description?: ReactNode; className?: string; children: ReactNode;
} & (K extends Enforced<T> ? { required: true } : { required?: boolean });
```

- **Источник истины — `z.input`, НЕ `z.infer`.** Для `.default()` ключ optional во входе (форма не обязана слать) → `required` корректно не форсится. Для `.transform()` `z.input` = pre-transform форма = имена полей формы.
- **`Field` рантайм — это существующий `FormField`, перетипизированный кастом внутри factory** (`FormField as unknown as TypedFieldComponent<T>`). Сигнатуру `FormField` **НЕ меняем**: runtime-компонент уже принимает `name`/`label`/`required`/`children`, а `TypedFieldProps<T,K>` — это его сужение (любой валидный по типу вызов валиден и в рантайме), поэтому каст соразмерен. Это:
  - **гарантирует backward-compat** — все 46 текущих `<FormField name="x">` остаются с прежним типом (opt-in миграция, не big-bang);
  - **снимает footgun индекс-сигнатуры**: если бы `FormField` стал generic с дефолтом `T = Record<string, unknown>`, `keyof` индекс-сигнатуры мог бы ложно пометить ключи как required в `RequiredKeys`/`Enforced` и форсить `required` везде. Каст обходит этот путь — generic-ность живёт только в `Field`, который всегда биндится к конкретному input-типу;
  - **минимизирует касание foundation** — `form-field.tsx` правок не требует (вся новизна в `typed-form.ts`).
- `TypedFieldComponent<T>` — generic function component `<K extends keyof T & string>(props: TypedFieldProps<T, K>) => ReactElement`; в TSX `K` инферится из значения `name`.

### 4.4. Escape-хетчи (честные границы)

- **boolean-required** — исключены из enforcement на уровне типа (`Enforced<T>`).
- **Поле вне схемы** (напр. `lecture_id`, которое форма постит, но `CommentCreateSchema` не описывает): `f()` примет только `keyof T`. Варианты: **(предпочтительно) добавить ключ в схему** — убирает скрытый дрейф «форма постит то, чего схема не валидирует»; либо raw-строка `name="lecture_id"` как явный escape. Решение — пер-слайс.
- **Динамические острова** (`forms/**` builder/fill, AST-редактор): внешняя форма биндится к своей схеме (`payload`/`answers` — её ключи), внутренние рантайм-поля схемой не описаны и остаются raw — factory туда не лезет. Корректно: form-builder рантайм-динамичен by design.

### 4.5. Канал типа сквозь guardrails

- В `schemas.ts` (server-only) добавляем `export type XFormInput = z.input<ReturnType<typeof makeXSchema>>` — одна строка на схему. Рядом с существующим `XInput = z.infer<…>` (тело API). Семантически разные: **форма даёт вход, экшен потребляет выход**.
- Client-форма внутри слайса: `import type { XFormInput } from "../schemas"` — **type-only, стирается компилятором**, рантайм-гард `server-only` не срабатывает. G1/G2 не задеты (не cross-feature, не deep-import; импорт относительный внутри слайса). Случайный *value*-импорт схемы по-прежнему падает на build — страховка цела.
- **Изменения `eslint.config.mjs` не требуются.**

### 4.6. Расположение и набор

- `createTypedForm` + типовые утилиты — новый файл `src/components/ui/typed-form.ts`, экспорт из `@/components/ui` (`index.ts`).
- Generic-изация `FormField` — правка `src/components/ui/form-field.tsx` (с backward-compat дефолтом `T`).
- Решённые микро-вопросы: (1) generic-им существующий `FormField`, не плодим `TypedFormField`; (2) имя factory — `createTypedForm<T>()` → `{ Field, f, errors }`; (3) boolean-исключение через тип `Enforced<T>` (не явный escape-проп).

---

## 5. Миграция (инкрементально)

Итерация 1 поставляет:

1. `createTypedForm` + generic `FormField` + type-level и рантайм-тесты.
2. Обновлённый `src/features/_template/` (форма-образец на новом API).
3. **2 показательные миграции**: `banners` (simple + hidden + Select) и `documents` **или** `comments` (hidden JSON-остров + Select).
4. Раздел в `docs/frontend-conventions.md` (как биндить форму к схеме, escape-хетчи, острова).

Остальные ~31 форма мигрируют **opt-in пер-слайс** (старый строковый `name` работает параллельно благодаря backward-compat дефолту). Совместимо с параллельными агентами — никакого форс-свипа.

---

## 6. Тестирование

- **Type-level** (`// @ts-expect-error` / `expect-type`-стиль): `f("неверный_ключ")` краснеет; `<Field>` без `required` на required-ключе краснеет; на optional-ключе — нет; boolean-required не форсит `required`; `errors(state)` имеет ключи схемы + `_form`.
- **Рантайм** (vitest): `createTypedForm().f` — identity; `errors(state)` извлекает `fieldErrors` при `code === "validation"`, `{}` иначе; `_form` пробрасывается.
- Существующие form-тесты остаются зелёными (backward-compat generic-дефолта).
- Перед PR: `pnpm lint && pnpm test && pnpm build`.

---

## 7. Что НЕ входит (итерация 2+)

- **Дедупликация `name`**: `Field` впрыскивает имя в дочерний контрол через React-context → `f` на контроле уходит (остаётся на hidden/raw). Required-enforcement уже закладывает generic/bound `Field`, на котором дедуп достраивается без переписывания форм.
- Сквозная типизация через `ActionResult` — отвергнута (см. §1).
- Перевод валидатора на Valibot ради бандла — не нужно (схемы server-only, в клиент не попадают).

---

## 8. Ссылки

- Ресёрч-обзор индустрии: deep-research 2026-06-22 (Conform / TanStack / RHF / Standard Schema).
- Инвентаризация форм проекта: 46 форм, 21 слайс, 180 `FormField`, 13 JSON-островов.
- Конвенции фронта: [docs/frontend-conventions.md](../../frontend-conventions.md) §3.4 (формы).
- Каркас: [src/components/ui/form.tsx](../../../src/components/ui/form.tsx), [form-field.tsx](../../../src/components/ui/form-field.tsx), [src/utils/create-action.ts](../../../src/utils/create-action.ts).

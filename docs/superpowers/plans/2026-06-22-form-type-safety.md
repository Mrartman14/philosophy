# Form Type-Safety (итерация 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать формам compile-time связь `name` ↔ ключи Zod-схемы, типизированные `errors` и required-enforcement из схемы — тонким type-only слоем, без рантайм-схемы в клиенте.

**Architecture:** Один factory `createTypedForm<z.input<schema>>()` в kit возвращает `{ Field, f, errors }`. `Field` — перетипизированный КАСТ существующего `FormField` (сигнатуру не меняем). `f` — типизированный аксессор имени для контролов/hidden-инпутов. `errors` — типизированная карта из `ActionResult`. Тип схемы доходит до клиента через `import type` из server-only `schemas.ts` (стирается компилятором).

**Tech Stack:** Next.js 16 / React 19 / TypeScript 6 (strict + exactOptionalPropertyTypes) / Zod 4 / Base UI / Vitest / pnpm.

## Global Constraints

- **Пакетный менеджер — только `pnpm`.** `npm install` ломает тулчейн (ложные lint/test-падения).
- **Общение с пользователем — на русском.** Имена файлов в `src/` — kebab-case.
- **Git:** НЕ делать `git stash`/`reset`/`checkout .`/`clean`; НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени; коммитить через `git commit --only <те же файлы>` (параллельные агенты). НЕ пушить.
- **Биндить формы к `z.input<schema>`, НЕ `z.infer`** — у схем есть `.transform()`, `z.input` = pre-transform форма = имена полей формы; для `.default()` `z.input` корректно помечает ключ optional.
- **Канал типа:** `import type { XFormInput } from "../schemas"` (относительный, внутри слайса) — ТОЛЬКО type-only. НИКОГДА не value-импортить схему в `"use client"` (упадёт build «server-only cannot be imported from a Client Component» — это намеренная страховка).
- **НЕ менять `eslint.config.mjs`.** **НЕ менять рантайм-сигнатуру `FormField`** — `Field` это `as`-каст.
- **Зелёные перед PR:** `pnpm lint && pnpm test && pnpm build`. Для type-level утверждений — `pnpm typecheck` (`tsc --noEmit`, покрывает `**/*.tsx` включая тесты).
- **Субагенты** (если запускаются) — на модели **opus**, не haiku.
- **Вне охвата (итерация 2+):** дедупликация `name` (Field впрыскивает имя в контрол), сквозная типизация через `ActionResult`. Не реализовывать.

---

## File Structure

| Файл | Ответственность | Действие |
| --- | --- | --- |
| `src/components/ui/typed-form.ts` | Factory `createTypedForm` + типовая машинерия (`RequiredKeys`/`EnforcedKeys`/`TypedFieldProps`/`FieldErrors`) | Create |
| `src/components/ui/typed-form.test.tsx` | Рантайм-тесты (`f`/`errors`) + type-level утверждения (`@ts-expect-error`) | Create |
| `src/components/ui/index.ts` | Реэкспорт `createTypedForm` + типов из kit | Modify |
| `src/features/banners/schemas.ts` | Добавить `BannerCreateFormInput = z.input<…>` | Modify |
| `src/features/banners/ui/banner-create-form.tsx` | Образец миграции №1 (happy-path: required/optional, Select, hidden через `f`) | Modify |
| `src/features/comments/schemas.ts` | Добавить `CommentCreateFormInput = z.input<…>` | Modify |
| `src/features/comments/ui/comment-create-form.tsx` | Образец миграции №2 (escape-хетчи: out-of-schema `lecture_id` + JSON-остров `blocks`) | Modify |
| `src/features/_template/schemas.ts` | Конвенция экспорта `z.input`-form-input типа (в примере-комментарии) | Modify |
| `src/features/_template/README.md` | Пункт чеклиста про типизированную форму | Modify |
| `docs/frontend-conventions.md` | §3.4 — обновить образец формы на типизированный API + escape-хетчи | Modify |

---

## Task 1: Core factory `createTypedForm` + тесты

**Files:**
- Create: `src/components/ui/typed-form.ts`
- Create: `src/components/ui/typed-form.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `FormField`, `FormFieldProps` из `./form-field`; `ActionResult` (type) из `@/utils/create-action`.
- Produces:
  - `createTypedForm<T>(): { Field: TypedFieldComponent<T>; f: (name: keyof T & string) => string; errors: (state: ActionResult<unknown>) => FieldErrors<T> }`
  - `TypedFieldComponent<T>`: `<K extends keyof T & string>(props: TypedFieldProps<T, K>) => ReactElement`
  - `TypedFieldProps<T, K>` = `Omit<FormFieldProps, "name"|"required"> & { name: K } & (K extends EnforcedKeys<T> ? { required: true } : { required?: boolean })`
  - `FieldErrors<T>` = `Partial<Record<keyof T & string, string>> & { _form?: string }`

- [ ] **Step 1: Write the failing test** (`src/components/ui/typed-form.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";

import type { ActionResult } from "@/utils/create-action";

import { createTypedForm } from "./typed-form";

type Sample = { title: string; note?: string; count: number };

describe("createTypedForm", () => {
  it("f возвращает имя поля (identity)", () => {
    const { f } = createTypedForm<Sample>();
    expect(f("title")).toBe("title");
  });

  it("errors извлекает fieldErrors при code=validation", () => {
    const { errors } = createTypedForm<Sample>();
    const state: ActionResult<unknown> = {
      success: false,
      code: "validation",
      error: "x",
      fieldErrors: { title: "плохо", _form: "cross-field" },
    };
    expect(errors(state)).toEqual({ title: "плохо", _form: "cross-field" });
  });

  it("errors возвращает {} вне validation-ветки", () => {
    const { errors } = createTypedForm<Sample>();
    expect(errors({ success: true, data: undefined })).toEqual({});
    expect(errors({ success: false, error: "x", code: "forbidden" })).toEqual({});
  });

  // Type-level утверждения: валидируются `pnpm typecheck`, НЕ исполняются
  // (typeChecks никогда не вызывается → ноль рендера). Ссылка ниже гасит
  // no-unused-vars; снятая ошибка в @ts-expect-error → tsc упадёт.
  function typeChecks() {
    const tf = createTypedForm<Sample>();
    tf.f("title");
    // @ts-expect-error — ключ не из схемы
    tf.f("nope");

    const e = tf.errors({ success: false, code: "validation", error: "", fieldErrors: {} });
    void e.title;
    void e._form;
    // @ts-expect-error — несуществующий ключ ошибки
    void e.nope;

    return [
      <tf.Field key="a" name="title" label="x" required>{null}</tf.Field>,
      // @ts-expect-error — required обязателен для required-ключа title
      <tf.Field key="b" name="title" label="x">{null}</tf.Field>,
      <tf.Field key="c" name="note" label="x">{null}</tf.Field>,
      // @ts-expect-error — ключ не из схемы
      <tf.Field key="d" name="nope" label="x">{null}</tf.Field>,
    ];
  }

  it("type-level утверждения существуют (валидируются typecheck)", () => {
    expect(typeof typeChecks).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/typed-form.test.tsx`
Expected: FAIL — `Failed to resolve import "./typed-form"` (модуль ещё не создан).

- [ ] **Step 3: Write the factory** (`src/components/ui/typed-form.ts`)

```ts
// src/components/ui/typed-form.ts
import type { ReactElement } from "react";

import type { ActionResult } from "@/utils/create-action";

import { FormField, type FormFieldProps } from "./form-field";

/** Ключи объекта-типа, НЕ помеченные `?` (required во входе схемы). */
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Required-ключи, для которых форсим проп `required`. boolean-ключи исключаем:
 * required boolean ≠ «галка обязана быть нажата» (ложное срабатывание).
 */
type EnforcedKeys<T> = {
  [K in RequiredKeys<T> & string]: T[K] extends boolean ? never : K;
}[RequiredKeys<T> & string];

type FieldName<T> = keyof T & string;

/** Пропсы Field: `name` ⊂ keyof T; `required` обязателен для enforced-ключей. */
type TypedFieldProps<T, K extends FieldName<T>> = Omit<
  FormFieldProps,
  "name" | "required"
> & { name: K } & (K extends EnforcedKeys<T>
    ? { required: true }
    : { required?: boolean });

export interface TypedFieldComponent<T> {
  <K extends FieldName<T>>(props: TypedFieldProps<T, K>): ReactElement;
}

/**
 * Карта ошибок: ключи ⊂ keyof T плюс cross-field `_form`. Assignable к
 * `Record<string, string>` (= тип пропа `<Form errors>`) — проверено tsc под
 * strict+exactOptionalPropertyTypes. Чтение неизвестного ключа (`e.nope`) —
 * ошибка компиляции (нет index-signature) → typo-защита ключей сохраняется.
 * Это типизированный VIEW поверх рантайм-`Record<string,string>` (cast):
 * корректен для top-level ключей; нестандартные пути Zod (`path:["x","0"]`)
 * в тип не попадут — для плоских схем образцов неактуально.
 */
export type FieldErrors<T> = Partial<Record<FieldName<T>, string>> & {
  _form?: string;
};

export interface TypedForm<T> {
  /** Field-обёртка над kit `FormField`: name ⊂ keyof T, required форсится. */
  Field: TypedFieldComponent<T>;
  /** Типизированное имя поля для контролов и hidden-инпутов. */
  f: (name: FieldName<T>) => string;
  /** Типизированная карта ошибок из ActionResult для `<Form errors>`. */
  errors: (state: ActionResult<unknown>) => FieldErrors<T>;
}

/**
 * Type-only слой типобезопасности форм. `T` — это `z.input<schema>` (НЕ `z.infer`):
 * имена полей и их required-ность берутся со ВХОДА схемы. Рантайм — identity + каст.
 *
 * `Field` — перетипизированный existing `FormField` (рантайм-сигнатура не меняется:
 * любой валидный по `TypedFieldProps` вызов валиден и в рантайме). Generic-ность
 * живёт только в `Field`, всегда связанном с конкретным input-типом.
 */
export function createTypedForm<T>(): TypedForm<T> {
  return {
    Field: FormField as unknown as TypedFieldComponent<T>,
    f: (name) => name,
    errors: (state) =>
      !state.success && state.code === "validation"
        ? (state.fieldErrors as FieldErrors<T>)
        : ({} as FieldErrors<T>),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/typed-form.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Verify type-level assertions hold**

Run: `pnpm typecheck`
Expected: PASS, ноль ошибок. (Если убрать любую строку `// @ts-expect-error` — tsc должен покраснеть «Unused '@ts-expect-error' directive»; это и есть проверка машинерии.)

- [ ] **Step 6: Export from kit** (`src/components/ui/index.ts`)

Добавить строку после `export { FormField, type FormFieldProps } from "./form-field";`:

```ts
export { createTypedForm, type TypedForm, type TypedFieldComponent, type FieldErrors } from "./typed-form";
```

- [ ] **Step 7: Run lint + full test suite**

Run: `pnpm lint && pnpm vitest run src/components/ui/typed-form.test.tsx`
Expected: lint PASS, тесты PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/typed-form.ts src/components/ui/typed-form.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/typed-form.ts src/components/ui/typed-form.test.tsx src/components/ui/index.ts -m "feat(ui): createTypedForm — type-only слой name↔схема + required-enforcement

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Образец миграции №1 — `banners`

Happy-path: required/optional поля, Select, hidden через `f`. У banner-create-form `required` уже расставлены ровно по схеме — миграция чисто механическая (доказывает, что enforcement совпадает с реальностью).

**Files:**
- Modify: `src/features/banners/schemas.ts` (рядом с `BannerCreateInput`, строка ~143)
- Modify: `src/features/banners/ui/banner-create-form.tsx`

**Interfaces:**
- Consumes: `createTypedForm` (Task 1); `BannerCreateFormInput` (этот таск).
- Produces: `BannerCreateFormInput` = `z.input<ReturnType<typeof makeBannerCreateSchema>>` = `{ background_color: string; target_audience: "all"|"authenticated"|"admin"; dismissible: "true"|"false"; start_at: string; end_at?: string; event_id?: string }`.

- [ ] **Step 1: Добавить form-input тип** (`src/features/banners/schemas.ts`)

После строки `export type BannerCreateInput = z.infer<ReturnType<typeof makeBannerCreateSchema>>;` добавить:

```ts
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type BannerCreateFormInput = z.input<ReturnType<typeof makeBannerCreateSchema>>;
```

- [ ] **Step 2: Verify schema typechecks**

Run: `pnpm typecheck`
Expected: PASS (новый type-экспорт компилируется).

- [ ] **Step 3: Мигрировать форму** (`src/features/banners/ui/banner-create-form.tsx`) — полный файл

```tsx
"use client";
// src/features/banners/ui/banner-create-form.tsx
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  Checkbox,
  ColorInput,
  createTypedForm,
  Form,
  FormFeedback,
  IdempotencyField,
  Inline,
  Label,
  Select,
  Stack,
  SubmitButton,
  TextInput,
} from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createBanner } from "../actions";
import { audienceOptions } from "../display";
import type { BannerCreateFormInput } from "../schemas";
import type { Banner } from "../types";

const initial: ActionResult<Banner | null> = {
  success: true,
  data: null,
};

const { Field, f, errors } = createTypedForm<BannerCreateFormInput>();

export function BannerCreateForm() {
  const t = useT("banners");
  const router = useRouter();
  const [dismissible, setDismissible] = useState(true);
  const [state, action] = useActionState(createBanner, initial);

  useEffect(() => {
    if (state.success && state.data?.id) {
      router.push(`/admin/banners/${state.data.id}/edit`);
    }
  }, [state, router]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack className="max-w-xl">
        {/* Hidden input: omitted-чекбокс в FormData неотличим от «не менять». */}
        <input
          type="hidden"
          name={f("dismissible")}
          value={dismissible ? "true" : "false"}
        />
        <IdempotencyField result={state} />

        <Field name="background_color" label={t("fieldColor")} required>
          <ColorInput
            name={f("background_color")}
            defaultValue="#336699"
            required
            aria-label={t("fieldColor")}
          />
        </Field>

        <Field name="target_audience" label={t("fieldAudience")} required>
          <Select
            name={f("target_audience")}
            defaultValue="all"
            options={audienceOptions(t)}
            aria-label={t("fieldAudienceAriaLabel")}
          />
        </Field>

        <Inline align="center" gap="tight" className="text-sm">
          <Checkbox id="dismissible" checked={dismissible} onCheckedChange={setDismissible} />
          <Label htmlFor="dismissible">{t("fieldDismissible")}</Label>
        </Inline>

        <Field name="start_at" label={t("fieldStartAt")} required>
          <TextInput name={f("start_at")} type="datetime-local" required />
        </Field>

        <Field name="end_at" label={t("fieldEndAt")}>
          <TextInput name={f("end_at")} type="datetime-local" />
        </Field>

        <Field name="event_id" label={t("fieldEventId")}>
          <TextInput name={f("event_id")} placeholder={t("eventIdPlaceholder")} />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createAction")} />

        <div>
          <SubmitButton>{t("createButton")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
```

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. (`Field`/`f` биндятся к `BannerCreateFormInput`; `end_at`/`event_id` без `required` — ок, optional-ключи.)

- [ ] **Step 5: Sanity-проверка биндинга (введи опечатку → красное → откати)**

Временно поменяй `name={f("start_at")}` на `name={f("start")}` в одном месте.
Run: `pnpm typecheck`
Expected: FAIL — `Argument of type '"start"' is not assignable to parameter of type ...`.
Откати правку обратно на `f("start_at")`, повтори `pnpm typecheck` → PASS.

- [ ] **Step 6: Run full suite**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное (existing banner schema-тесты не тронуты).

- [ ] **Step 7: Commit**

```bash
git add src/features/banners/schemas.ts src/features/banners/ui/banner-create-form.tsx
git commit --only src/features/banners/schemas.ts src/features/banners/ui/banner-create-form.tsx -m "feat(banners): миграция create-формы на createTypedForm (образец №1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

> **Параллелизация:** Task 2 и Task 3 независимы (оба зависят только от Task 1, разные файлы) — можно исполнять параллельными агентами.

## Task 3: Образец миграции №2 — `comments` (escape-хетчи)

Демонстрирует: out-of-schema `lecture_id` (raw-строка, escape) + JSON-остров `blocks` (через `f`). Required-enforcement ловит реальный дрейф: `blocks` required в схеме (`blocksJsonField` = `z.string().min(1)…`), но в текущей форме у поля НЕТ `required` → миграция добавляет (звёздочка появляется — это корректно, тело обязательно).

**Files:**
- Modify: `src/features/comments/schemas.ts` (рядом с `CommentCreateInput`, строка ~83)
- Modify: `src/features/comments/ui/comment-create-form.tsx`

**Interfaces:**
- Consumes: `createTypedForm` (Task 1); `CommentCreateFormInput` (этот таск).
- Produces: `CommentCreateFormInput` = `z.input<ReturnType<typeof makeCommentCreateSchema>>` = `{ type: CommentType; blocks: string; parent_id?: string }`. (`lecture_id` НЕ входит — обрабатывается в action через `formData.get("lecture_id")`.)

- [ ] **Step 1: Добавить form-input тип** (`src/features/comments/schemas.ts`)

После строки `export type CommentCreateInput = z.infer<ReturnType<typeof makeCommentCreateSchema>>;` добавить:

```ts
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type CommentCreateFormInput = z.input<ReturnType<typeof makeCommentCreateSchema>>;
```

- [ ] **Step 2: Verify schema typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Мигрировать форму** (`src/features/comments/ui/comment-create-form.tsx`) — полный файл

```tsx
"use client";
// src/features/comments/ui/comment-create-form.tsx
import { useActionState, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { createComment } from "../actions";
import type { CommentCreateFormInput } from "../schemas";
import type { Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial: ActionResult<Comment | null> = { success: true, data: null };

const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

interface Props {
  lectureId: string;
  /** Типы, допустимые как корень (schema.allowed_roots). */
  rootTypes: CommentType[];
}

export function CommentCreateForm({ lectureId, rootTypes }: Props) {
  const t = useT("comments");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);

  const options = rootTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        {/* lecture_id — path-параметр (action читает его из FormData и шлёт в
            POST /api/lectures/{id}/comments), это НЕ body-поле схемы. Raw-строка
            name здесь КОРРЕКТНА — не «чинить» добавлением в CommentCreateSchema. */}
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <IdempotencyField result={state} />

        <Field name="type" label={t("createTypeLabel")} required>
          <Select name={f("type")} options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
        </Field>

        <Field name="blocks" label={t("createBodyLabel")} required>
          <LazyAstEditor
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </Field>

        {state.success && state.data && (
          <p className="text-sm text-(--color-fg-muted)">{t("createSuccess")}</p>
        )}
        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />

        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
```

> Замечание: `<Field name="blocks" … required>` — `required` теперь ОБЯЗАТЕЛЕН по типу (`blocks` required в `z.input`). Это и есть починка дрейфа «схема required, а звёздочки нет». Если на шаге typecheck `blocks` НЕ требует `required` — значит схема трактует поле optional; тогда убери `required` (следуй типу, не этому тексту).

- [ ] **Step 4: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. (`lecture_id` raw-строкой — ок; `f("blocks")`/`f("type")` типизированы; `blocks` Field требует `required`.)

- [ ] **Step 5: Sanity-проверка escape (что out-of-schema ловится при попытке через f)**

Временно поменяй `name="lecture_id"` на `name={f("lecture_id")}`.
Run: `pnpm typecheck`
Expected: FAIL — `"lecture_id"` не assignable к `keyof CommentCreateFormInput`. (Подтверждает: вне-схемные поля честно требуют raw-escape.)
Откати на `name="lecture_id"`, повтори → PASS.

- [ ] **Step 6: Run full suite**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 7: Commit**

```bash
git add src/features/comments/schemas.ts src/features/comments/ui/comment-create-form.tsx
git commit --only src/features/comments/schemas.ts src/features/comments/ui/comment-create-form.tsx -m "feat(comments): миграция create-формы на createTypedForm (образец №2, escape-хетчи)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `_template` + конвенции + финальный gate

**Files:**
- Modify: `src/features/_template/schemas.ts`
- Modify: `src/features/_template/README.md`
- Modify: `docs/frontend-conventions.md`

**Interfaces:**
- Consumes: всё из Task 1–3 (как канонический образец).
- Produces: документированный паттерн для будущих opt-in миграций.

- [ ] **Step 1: Расширить пример в шаблоне** (`src/features/_template/schemas.ts`)

Заменить блок-комментарий примера (строки с `// export const EntityCreateSchema …`) на:

```ts
// export const makeEntityCreateSchema = (t: NamespaceT<"validation">) =>
//   z.object({
//     title: z.string().min(1, t("entity.titleRequired")).max(200),
//     description: z.string().max(1000).optional(),
//   });
// // Тело API (выход) — для actions:
// export type EntityCreateInput = z.infer<ReturnType<typeof makeEntityCreateSchema>>;
// // Вход формы (имена полей + required-ность) — для createTypedForm<…> в "use client":
// // импортируй type-only: `import type { EntityCreateFormInput } from "../schemas"`.
// export type EntityCreateFormInput = z.input<ReturnType<typeof makeEntityCreateSchema>>;
```

- [ ] **Step 2: Добавить пункт чеклиста** (`src/features/_template/README.md`)

После строки `- [ ] Использует \`createFormAction\` + \`parseFormData\` + …` добавить:

```markdown
- [ ] Формы биндятся к схеме: `const { Field, f, errors } = createTypedForm<XCreateFormInput>()` (тип — `z.input`, не `z.infer`; `import type` из `schemas.ts`). `name` — через `Field`/`f`, ошибки — через `errors(state)`. Поля вне схемы (напр. контекстный `lecture_id`) — raw-строкой `name="…"`.
```

- [ ] **Step 3: Обновить §3.4 конвенций** (`docs/frontend-conventions.md`)

Заменить пример формы в §3.4 (блок ` ```tsx … <Form action={action} errors={fieldErrors}> … ``` `) на типизированный вариант и добавить абзац про escape-хетчи:

```tsx
"use client";
import { useActionState } from "react";
import { createTypedForm, Form, SubmitButton } from "@/components/ui";
import { createComment } from "@/features/comments";
import type { CommentCreateFormInput } from "@/features/comments/schemas";

const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

export function CreateCommentForm() {
  const [state, action] = useActionState(createComment, { success: true, data: undefined });
  return (
    <Form action={action} errors={errors(state)}>
      <Field name="text" label="Комментарий" required>
        <TextInput name={f("text")} />
      </Field>
      <SubmitButton>Отправить</SubmitButton>
    </Form>
  );
}
```

Абзац под примером:

```markdown
`createTypedForm<z.input<schema>>()` (из `@/components/ui`) связывает `name`-пропы и
`errors` с ключами Zod-схемы на уровне типов. Тип импортируется **type-only** из
server-only `schemas.ts` (`import type { XFormInput } from "../schemas"`) — стирается
компилятором, рантайм-схема в клиент не попадает. Биндить к `z.input` (НЕ `z.infer`):
имена и required-ность берутся со входа схемы. `Field` форсит `required` для
required-ключей. Поля вне схемы (контекстный `lecture_id`, инфра-инпуты) — raw-строкой
`name="…"`. Динамические формы (`forms/**` builder/fill) — рантайм-острова, слой не
применяется к их внутренним полям.
```

- [ ] **Step 4: Финальный gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: всё зелёное. (`pnpm typecheck` явно — type-level утверждения Task 1 и биндинги форм; `build` его дублирует, но typecheck быстрее фейлит.) Если красное — фикси, не отключай правила.

- [ ] **Step 5: Commit**

```bash
git add src/features/_template/schemas.ts src/features/_template/README.md docs/frontend-conventions.md
git commit --only src/features/_template/schemas.ts src/features/_template/README.md docs/frontend-conventions.md -m "docs(forms): конвенция createTypedForm в _template + frontend-conventions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (против `2026-06-22-form-type-safety-design.md`):
- §4.2 `createTypedForm` → `{ Field, f, errors }` — Task 1. ✅
- §4.3 required-enforcement из `z.input`, boolean-исключение, `Field`=каст — Task 1 (`EnforcedKeys`, cast). ✅
- §4.4 escape-хетчи (boolean-исключение / вне-схемы / острова) — Task 1 (boolean), Task 3 (`lecture_id` raw), Task 4 (доки про острова). ✅
- §4.5 канал типа `import type` без правок eslint — Task 2/3 (type-only import), Global Constraints. ✅
- §4.6 расположение (`typed-form.ts` + index) — Task 1. ✅
- §5 миграция: factory + `_template` + 2 образца + раздел конвенций — Tasks 1–4. ✅
- §6 тесты: type-level (`@ts-expect-error`) + runtime — Task 1. ✅
- §7 вне охвата (дедуп, сквозной ActionResult) — Global Constraints («не реализовывать»). ✅

**Placeholder scan:** нет TBD/«handle edge cases»/«similar to». Полный код в каждом шаге. ✅

**Type consistency:** `createTypedForm`/`Field`/`f`/`errors`/`FieldErrors`/`TypedFieldComponent`/`EnforcedKeys` — имена согласованы между Task 1 (определение) и Task 2–4 (потребление). `BannerCreateFormInput`/`CommentCreateFormInput` = `z.input<ReturnType<typeof makeXSchema>>` — согласованы между schemas.ts и формой. ✅

---

## Review verification (2026-06-22, эмпирически через изолированный `tsc`)

Несущие допущения проверены прогоном `tsc --strict --exactOptionalPropertyTypes` на спайках (удалены после проверки), а не «по памяти»:

- ✅ **Типовая машинерия** (`RequiredKeys`/`EnforcedKeys`/`TypedFieldProps`) компилируется под TS 6 strict+exactOptional.
- ✅ **Required-enforcement работает**: отсутствие `required` на required-ключе → ошибка компиляции; на optional-ключе — нет.
- ✅ **boolean-исключение работает**: required `z.boolean()`-ключ НЕ требует `required`.
- ✅ **`z.input` через `.transform()`/`.default()`**: даёт pre-transform форму; `.default()`-ключ optional во входе (required не форсится).
- ✅ **Name-биндинг**: не-ключ в `name` / `f()` → ошибка компиляции.
- ✅ **JSX generic-компонент из const** (`Field`): инференс `K` из `name` + enforcement работают в JSX.
- ✅ **`FieldErrors<T>` assignable к `Record<string,string>`** (тип `<Form errors>`), при этом `e.nope` остаётся ошибкой → typo-защита ключей ошибок сохранена. (Снято подозрение на assignability-баг под exactOptional.)
- ✅ **lint/CI-совместимость**: `@ts-expect-error` уже используется в kit-тестах (button/checkbox/label) и НЕ забанен; идиома `void x` прецедентна; `next.config.ts` без `ignoreBuildErrors` → `build` типчекает тест-файлы (tsconfig include `**/*.tsx`).

**Вывод ревью:** план технически верен и исполним; самые рискованные claim'ы доказаны. Правки по итогам: уточнён комментарий к `lecture_id` (path-параметр, raw корректен — не «чинить»), задокументирована природа cast'а `FieldErrors`, добавлен `pnpm typecheck` в финальный gate, отмечена параллелизуемость Task 2/3.

# Online Idempotency Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать мутирующим формам опциональную защиту от дубль-применения (двойной клик, повтор после потери ответа) поверх существующего фронтового анти-дабл-сабмита, переиспользуя `Idempotency-Key`, который бекенд раскатывает на мутирующие ручки.

**Architecture:** Клиент держит ключ идемпотентности в скрытом поле формы — стабильный на время жизни формы, ротируется после каждого успешного сабмита. `createFormAction` извлекает ключ из `FormData` и отдаёт его обработчику вторым аргументом-контекстом; server action пробрасывает ключ в заголовок `Idempotency-Key` вызова бэка. Это **не транспортная middleware**: ключ рождается на уровне «одно намерение пользователя», а транспорт лишь несёт его. Идемпотентность включается per-form (opt-in), а не глобально.

**Tech Stack:** Next.js server actions, React `useActionState`, Base UI `<Form>`, `openapi-fetch`, Zod, Vitest + Testing Library (jsdom).

---

## Контекст и решения (прочитать перед стартом)

- **Семантика бэка (Stripe):** дубль = совпадение `(user_id, key)` И байт-идентичный `(method, path, body)`. Любое расхождение тела при том же ключе → **422 `IDEMPOTENCY_KEY_REUSED`**. Ошибки (не-2xx) НЕ кэшируются → ретрай с тем же ключом после ошибки реально перевыполняет запрос. Параллельный запрос с тем же ключом → **409 `IDEMPOTENCY_KEY_IN_USE`**. Пустой/>255 → **400 `IDEMPOTENCY_KEY_INVALID`**.
- **Почему стабильный ключ + ротация на успехе (а не транспортная middleware):** идемпотентность работает только когда ТОТ ЖЕ ключ повторяется на повторе ТОЙ ЖЕ операции. Транспорт видит один `fetch` и не знает, «это повтор». Middleware, минтящая свежий ключ на каждый запрос, даёт нулевую защиту. Единица стабильности ключа — «одна форма / одно намерение», ею владеет клиентский компонент формы.
- **Почему ротация ПОСЛЕ успеха обязательна (а не «опционально»):** форма комментария остаётся смонтированной. Без ротации второй (уже другой) комментарий уйдёт с тем же ключом, что и первый успешный → бэк закешировал первый success → **422 REUSED**. Ротация на успехе даёт второй отправке свежий ключ.
- **Известный edge (осознанно принят, обрабатывается текстом ошибки):** success + потеря ответа + правка тела + повтор → 422 REUSED (бэк уже закешировал первый success с другим телом). Узкий, потому что НЕ-успех (4xx/5xx) не кэшируется, значит правка-после-ошибки 422 не даёт. Закрывается дружелюбным сообщением в `rethrowApiError`, не кодом.
- **Foundation-зона:** PR трогает `src/utils/create-action.ts`, `src/utils/api-error.ts`, `src/components/ui/*`, `_template`, `docs/frontend-conventions.md` — это намеренный foundation-update PR, не внутри фичи.
- **Параллельные агенты:** НЕ делать `git add -A`/`git add .`, деструктивные git-операции запрещены. Коммитить только перечисленные файлы по имени.
- **Скоуп этого PR:** foundation + один референс-адаптер (создание комментария) + шаблон + документация. Раскатка на остальные формы — механический follow-up (см. «После PR»).
- **Гейт перед PR:** `pnpm lint && pnpm test && pnpm build` зелёные.

## File Structure

- **Create** `src/utils/idempotency.ts` — client-safe (без `server-only`): константа имени поля/заголовка, `readIdempotencyKey(formData)`, `idempotencyHeaders(key)`. Чистые функции, без зависимостей.
- **Create** `src/utils/idempotency.test.ts` — юнит-тесты на чтение ключа и сборку заголовка.
- **Modify** `src/utils/create-action.ts` — `createFormAction` извлекает ключ и прокидывает `ctx: FormActionContext` вторым аргументом обработчику (не ломает существующие `(formData) => …`).
- **Modify** `src/utils/create-action.test.ts` — тест на проброс `ctx.idempotencyKey`.
- **Modify** `src/utils/api-error.ts` — три идемпотентных кода в `DEFAULT_MESSAGES`.
- **Modify** `src/utils/api-error.test.ts` — тесты на маппинг трёх кодов.
- **Create** `src/components/ui/idempotency-field.tsx` — `"use client"` компонент: скрытый input + политика ключа (стабилен, ротация на успехе).
- **Create** `src/components/ui/idempotency-field.test.tsx` — компонент-тест политики ротации.
- **Modify** `src/components/ui/index.ts` — экспорт `IdempotencyField`.
- **Modify** `src/features/comments/ui/comment-create-form.tsx` — вставить `<IdempotencyField result={state} />`.
- **Modify** `src/features/comments/actions.ts` — `createComment` пробрасывает `idempotencyHeaders(ctx.idempotencyKey)`.
- **Create** `src/features/comments/create-comment-idempotency.test.ts` — проверка проброса заголовка.
- **Modify** `src/features/_template/actions.ts` — пример в шаблоне (закомментированный референс). (`_template/ui/` содержит только `.gitkeep` — UI-файлов нет, не трогаем.)
- **Modify** `docs/frontend-conventions.md` — раздел «Идемпотентность мутирующих форм» + чеклист адаптации.

---

### Task 1: Idempotency utils (client-safe)

**Files:**
- Create: `src/utils/idempotency.ts`
- Test: `src/utils/idempotency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/idempotency.test.ts
import { describe, it, expect } from "vitest";

import {
  IDEMPOTENCY_FIELD,
  IDEMPOTENCY_HEADER,
  idempotencyHeaders,
  readIdempotencyKey,
} from "./idempotency";

function fdWith(value: string | undefined): FormData {
  const fd = new FormData();
  if (value !== undefined) fd.set(IDEMPOTENCY_FIELD, value);
  return fd;
}

describe("readIdempotencyKey", () => {
  it("returns the key when present and valid", () => {
    expect(readIdempotencyKey(fdWith("abc-123"))).toBe("abc-123");
  });

  it("returns undefined when field is absent", () => {
    expect(readIdempotencyKey(fdWith(undefined))).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(readIdempotencyKey(fdWith(""))).toBeUndefined();
  });

  it("returns undefined for keys longer than 255 chars", () => {
    expect(readIdempotencyKey(fdWith("x".repeat(256)))).toBeUndefined();
  });

  it("accepts a key exactly 255 chars long", () => {
    const key = "x".repeat(255);
    expect(readIdempotencyKey(fdWith(key))).toBe(key);
  });
});

describe("idempotencyHeaders", () => {
  it("builds a header object when key is present", () => {
    expect(idempotencyHeaders("k1")).toEqual({ [IDEMPOTENCY_HEADER]: "k1" });
  });

  it("returns an empty object when key is undefined", () => {
    expect(idempotencyHeaders(undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/idempotency.test.ts`
Expected: FAIL — `Cannot find module './idempotency'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/idempotency.ts
/**
 * Идемпотентность мутирующих форм (онлайн).
 *
 * Клиент кладёт ключ в скрытое поле `IDEMPOTENCY_FIELD` (см.
 * `src/components/ui/idempotency-field.tsx`), `createFormAction` извлекает его
 * в `ctx.idempotencyKey`, а server action пробрасывает в заголовок
 * `Idempotency-Key` вызова бэка через `idempotencyHeaders`.
 *
 * Модуль client-safe (БЕЗ `import "server-only"`): `IDEMPOTENCY_FIELD`
 * импортирует и клиентский `<IdempotencyField/>`.
 */

/** Имя скрытого поля формы с ключом идемпотентности. */
export const IDEMPOTENCY_FIELD = "__idempotency_key";

/** Имя HTTP-заголовка, который понимает бекенд. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** Максимальная длина ключа (>255 → 400 IDEMPOTENCY_KEY_INVALID на беке). */
const MAX_KEY_LENGTH = 255;

/**
 * Достаёт ключ из FormData. `undefined`, если поля нет, оно не строка, пустое
 * или длиннее 255 (такой ключ бэк отверг бы 400 — лучше не слать).
 */
export function readIdempotencyKey(formData: FormData): string | undefined {
  const value = formData.get(IDEMPOTENCY_FIELD);
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_KEY_LENGTH) return undefined;
  return value;
}

/**
 * Заголовки для openapi-fetch / fetch. Пустой объект, если ключа нет — запрос
 * идёт без идемпотентности (бэк трактует как обычный).
 */
export function idempotencyHeaders(
  key: string | undefined,
): Record<string, string> {
  return key ? { [IDEMPOTENCY_HEADER]: key } : {};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/idempotency.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/idempotency.ts src/utils/idempotency.test.ts
git commit -m "feat(idempotency): client-safe key field/header helpers"
```

---

### Task 2: `createFormAction` прокидывает ключ в контекст

**Files:**
- Modify: `src/utils/create-action.ts`
- Test: `src/utils/create-action.test.ts`

- [ ] **Step 1: Write the failing test** (добавить в конец `create-action.test.ts`, внутри нового `describe`)

```ts
describe("createFormAction idempotency context", () => {
  it("passes idempotencyKey from the hidden field to the handler", async () => {
    let received: string | undefined = "UNSET";
    const action = createFormAction((_fd: FormData, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    const fd = new FormData();
    fd.set("__idempotency_key", "key-42");
    await action({ success: false, error: "" }, fd);
    expect(received).toBe("key-42");
  });

  it("passes undefined when the field is absent", async () => {
    let received: string | undefined = "UNSET";
    const action = createFormAction((_fd: FormData, ctx) => {
      received = ctx.idempotencyKey;
      return Promise.resolve(null);
    });
    await action({ success: false, error: "" }, new FormData());
    expect(received).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/create-action.test.ts`
Expected: FAIL — `ctx` typed/undefined, `received` stays `"UNSET"` or TS error «Expected 1 arguments».

- [ ] **Step 3: Write minimal implementation**

В `src/utils/create-action.ts` добавить импорт под существующими:

```ts
import { readIdempotencyKey } from "./idempotency";
```

Добавить тип перед `createFormAction`:

```ts
/** Контекст, который `createFormAction` прокидывает обработчику вторым
 * аргументом. Существующие обработчики `(formData) => …` его игнорируют
 * (функция, принимающая меньше аргументов, совместима по типу). */
export interface FormActionContext {
  /** Ключ идемпотентности из скрытого поля формы (или `undefined`). */
  idempotencyKey: string | undefined;
}
```

Заменить `createFormAction` целиком на:

```ts
export function createFormAction<TOutput>(
  fn: (formData: FormData, ctx: FormActionContext) => Promise<TOutput>
): (
  prevState: ActionResult<TOutput>,
  formData: FormData
) => Promise<ActionResult<TOutput>> {
  return async (_prevState: ActionResult<TOutput>, formData: FormData) => {
    try {
      const ctx: FormActionContext = {
        idempotencyKey: readIdempotencyKey(formData),
      };
      const data = await fn(formData, ctx);
      return { success: true, data };
    } catch (error) {
      if (isNextInternalError(error)) throw error;
      return toResult<TOutput>(error);
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/create-action.test.ts`
Expected: PASS (старые тесты `createFormAction` + 2 новых).

- [ ] **Step 5: Typecheck (существующие `(formData) =>` обработчики не сломались)**

Run: `pnpm typecheck`
Expected: 0 ошибок (передача функции с одним параметром туда, где тип ждёт два, валидна в TS).

- [ ] **Step 6: Commit**

```bash
git add src/utils/create-action.ts src/utils/create-action.test.ts
git commit -m "feat(idempotency): createFormAction passes idempotency key via context"
```

---

### Task 3: Дружелюбные тексты для идемпотентных кодов

**Files:**
- Modify: `src/utils/api-error.ts:42-46` (объект `DEFAULT_MESSAGES`)
- Test: `src/utils/api-error.test.ts`

- [ ] **Step 1: Write the failing test** (добавить новый `describe` в `api-error.test.ts`)

```ts
describe("rethrowApiError idempotency codes", () => {
  it("maps IDEMPOTENCY_KEY_IN_USE to a wait message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_IN_USE" })).toThrow(
      /уже обрабатывается/i,
    );
  });

  it("maps IDEMPOTENCY_KEY_REUSED to a conflict message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_REUSED" })).toThrow(
      /конфликтует/i,
    );
  });

  it("maps IDEMPOTENCY_KEY_INVALID to a refresh message", () => {
    expect(() => rethrowApiError({ code: "IDEMPOTENCY_KEY_INVALID" })).toThrow(
      /ключ идемпотентности/i,
    );
  });
});
```

> Если в `api-error.test.ts` ещё нет импорта `rethrowApiError` — добавить его в существующий блок импортов: `import { rethrowApiError } from "./api-error";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/api-error.test.ts`
Expected: FAIL — коды падают в фоллбек `Error("Ошибка сервера")`, регэкспы не матчатся.

- [ ] **Step 3: Write minimal implementation**

В `src/utils/api-error.ts` дополнить `DEFAULT_MESSAGES`:

```ts
const DEFAULT_MESSAGES: ApiErrorMessages = {
  REF_NOT_FOUND: "Одна из ссылок указывает на несуществующий объект.",
  BLOCKS_HAVE_ANCHORS:
    "Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.",
  IDEMPOTENCY_KEY_IN_USE:
    "Запрос уже обрабатывается. Подождите, не отправляйте повторно.",
  IDEMPOTENCY_KEY_REUSED:
    "Изменённый запрос конфликтует с уже отправленным. Обновите страницу.",
  IDEMPOTENCY_KEY_INVALID:
    "Некорректный ключ идемпотентности. Обновите страницу и повторите.",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/api-error.test.ts`
Expected: PASS (старые + 3 новых).

- [ ] **Step 5: Commit**

```bash
git add src/utils/api-error.ts src/utils/api-error.test.ts
git commit -m "feat(idempotency): friendly messages for idempotency error codes"
```

---

### Task 4: `<IdempotencyField>` — клиентский компонент политики ключа

**Files:**
- Create: `src/components/ui/idempotency-field.tsx`
- Test: `src/components/ui/idempotency-field.test.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/idempotency-field.test.tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/utils/create-action";

import { IdempotencyField } from "./idempotency-field";

afterEach(cleanup);

const ok: ActionResult<unknown> = { success: true, data: null };
const fail: ActionResult<unknown> = { success: false, error: "boom" };

function keyValue(container: HTMLElement): string {
  // eslint-disable-next-line testing-library/no-node-access -- скрытый input без роли/лейбла, RTL-запросом не достать (прецедент: router-link-busy.test.tsx)
  const input = container.querySelector<HTMLInputElement>(
    'input[name="__idempotency_key"]',
  );
  if (!input) throw new Error("hidden field not rendered");
  return input.value;
}

describe("IdempotencyField", () => {
  beforeEach(() => {
    let n = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
      () => `key-${++n}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a hidden field with a generated key", () => {
    const { container } = render(<IdempotencyField result={ok} />);
    expect(keyValue(container)).toBe("key-1");
  });

  it("keeps the key unchanged after a failed submit", () => {
    const { container, rerender } = render(<IdempotencyField result={ok} />);
    const before = keyValue(container);
    rerender(<IdempotencyField result={fail} />);
    expect(keyValue(container)).toBe(before);
  });

  it("rotates the key after a successful submit", () => {
    const { container, rerender } = render(<IdempotencyField result={fail} />);
    const before = keyValue(container);
    // новый success-объект (как вернул бы useActionState)
    rerender(<IdempotencyField result={{ success: true, data: 1 }} />);
    expect(keyValue(container)).not.toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/idempotency-field.test.tsx`
Expected: FAIL — `Cannot find module './idempotency-field'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";
// src/components/ui/idempotency-field.tsx
import { useState } from "react";

import type { ActionResult } from "@/utils/create-action";
import { IDEMPOTENCY_FIELD } from "@/utils/idempotency";

interface Props {
  /** Текущее значение из `useActionState` формы — триггер ротации после успеха. */
  result: ActionResult<unknown>;
}

/**
 * Скрытое поле с ключом идемпотентности для мутирующей формы.
 *
 * Политика ключа:
 * - стабилен на время жизни формы → защищает от двойного клика и повтора после
 *   потери ответа (тот же ключ → бэк реплеит, а не дублирует);
 * - ротируется ПОСЛЕ каждого успешного сабмита → следующая (уже другая)
 *   мутация получает свежий ключ, иначе словила бы 422 REUSED.
 *
 * Известный edge: success + потеря ответа + правка тела + повтор → 422 REUSED;
 * обрабатывается текстом в `rethrowApiError`. См. docs/frontend-conventions.md.
 *
 * Поместить ВНУТРЬ `<Form>` рядом с прочими hidden-полями.
 *
 * Ротация — паттерн «adjust state during render» (react.dev), НЕ useEffect:
 * правило `react-hooks/set-state-in-effect` (активно, error) запрещает setState
 * в эффектах. Сравнение текущего `result` с предыдущим ловит переход в success
 * без эффекта (как в `src/features/tags/ui/tag-admin-row.tsx`).
 */
export function IdempotencyField({ result }: Props) {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const [prevResult, setPrevResult] = useState(result);

  // На монтировании prevResult === result (та же ссылка) → ротации нет.
  // useActionState отдаёт новый объект на каждый сабмит → ловим переход в success.
  if (result !== prevResult) {
    setPrevResult(result);
    if (result.success) setKey(crypto.randomUUID());
  }

  return (
    <input type="hidden" name={IDEMPOTENCY_FIELD} value={key} readOnly />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/idempotency-field.test.tsx`
Expected: PASS (3 теста).

- [ ] **Step 5: Export from the UI barrel**

В `src/components/ui/index.ts` добавить строкой (рядом с `export { SubmitButton } …`):

```ts
export { IdempotencyField } from "./idempotency-field";
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/idempotency-field.tsx src/components/ui/idempotency-field.test.tsx src/components/ui/index.ts
git commit -m "feat(idempotency): IdempotencyField hidden-field component with rotate-on-success"
```

---

### Task 5: Референс-адаптер — создание комментария

**Files:**
- Modify: `src/features/comments/actions.ts:55-76` (`createComment`)
- Modify: `src/features/comments/ui/comment-create-form.tsx`
- Test: `src/features/comments/create-comment-idempotency.test.ts`

> **Замечание о бэк-покрытии:** ручка `/api/lectures/{id}/comments` УЖЕ объявляет header-параметр `Idempotency-Key` и ответ 409 `IDEMPOTENCY_KEY_IN_USE` в `src/api/schema.ts` — бэк её покрыл, защита включается этим PR немедленно (не follow-up), и `headers` проходит типизацию openapi-fetch. Таск доказывает сквозной плумбинг формы→ключ→заголовок.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/comments/create-comment-idempotency.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMENT_TYPES } from "@/api/enums";

const post = vi.fn();

vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ POST: post }),
}));
vi.mock("@/utils/me", () => ({
  getMe: () =>
    Promise.resolve({ id: "u1", status: "active", role: "user", capabilities: [] }),
}));
vi.mock("./permissions", () => ({
  canCreateComment: () => true,
  canModerateComments: () => true,
}));
vi.mock("@/utils/revalidate", () => ({ revalidateEntity: vi.fn() }));

// импорт ПОСЛЕ vi.mock (hoisted)
import { createComment } from "./actions";

const initial = { success: false as const, error: "" };

function commentForm(extra: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("lecture_id", "lec-1");
  fd.set("type", COMMENT_TYPES[0]);
  fd.set("blocks", JSON.stringify(["x"]));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("createComment idempotency wiring", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { data: { id: "c1" } }, error: undefined });
  });

  it("forwards Idempotency-Key header from the hidden field", async () => {
    await createComment(initial, commentForm({ __idempotency_key: "key-123" }));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      headers: { "Idempotency-Key": "key-123" },
    });
  });

  it("sends no idempotency header when the field is absent", async () => {
    await createComment(initial, commentForm({}));
    const opts = post.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(opts.headers?.["Idempotency-Key"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/comments/create-comment-idempotency.test.ts`
Expected: FAIL — `headers` отсутствует в опциях `POST` (ключ ещё не пробрасывается).

- [ ] **Step 3: Wire the action**

В `src/features/comments/actions.ts` добавить импорт под существующими:

```ts
import { idempotencyHeaders } from "@/utils/idempotency";
```

Заменить сигнатуру и вызов `createComment` (строки ~55-76): добавить второй аргумент `ctx` и `headers`, СОХРАНИВ `rethrowApiError(error, ERRORS)` (декларативная карта кодов слайса — НЕ уронить второй аргумент):

```ts
export const createComment = createFormAction(async (formData, ctx) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);
  const rawLectureId = formData.get("lecture_id");
  const lectureId = typeof rawLectureId === "string" ? rawLectureId : "";
  if (!lectureId) throw new Error("Не указана лекция.");
  const input = parseFormData(CommentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId } },
    body: {
      type: input.type,
      blocks: input.blocks as never,
      ...(input.parent_id ? { parent_id: input.parent_id } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
  if (error) rethrowApiError(error, ERRORS);
  revalidateEntity(Tags.COMMENTS, lectureId);
  revalidateEntity(Tags.COMMENTS);
  return (data.data ?? null) as Comment | null;
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/comments/create-comment-idempotency.test.ts`
Expected: PASS (2 теста).

- [ ] **Step 5: Wire the form**

В `src/features/comments/ui/comment-create-form.tsx`:

1. Добавить `IdempotencyField` в импорт из `@/components/ui`:

```tsx
import { Form, FormField, IdempotencyField, Select, SubmitButton } from "@/components/ui";
```

2. Вставить компонент внутри `<Form>` рядом с hidden-полями (после строки с `<input type="hidden" name="blocks" … />`):

```tsx
      <IdempotencyField result={state} />
```

- [ ] **Step 6: Typecheck + lint changed files**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 ошибок (в т.ч. ESLint-гарды слайса: импорт `@/components/ui` и `@/utils/idempotency` легальны).

- [ ] **Step 7: Commit**

```bash
git add src/features/comments/actions.ts src/features/comments/ui/comment-create-form.tsx src/features/comments/create-comment-idempotency.test.ts
git commit -m "feat(comments): opt comment-create form into idempotency"
```

---

### Task 6: Шаблон + документация конвенций

**Files:**
- Modify: `src/features/_template/actions.ts`
- Modify: `docs/frontend-conventions.md`

- [ ] **Step 1: Дополнить закомментированный пример в шаблоне**

В `src/features/_template/actions.ts` заменить закомментированный блок `createEntity` на версию с идемпотентностью (остаётся комментарием — это референс, не исполняемый код):

```ts
// export const createEntity = createFormAction(async (formData, ctx) => {
//   const me = await getMe();
//   const input = parseFormData(EntityCreateSchema, formData);
//   requireCapability(me, canCreateEntity);
//   const api = await createApiClient();
//   const { data, error } = await api.POST("/entities", {
//     body: input,
//     // идемпотентность: ключ приходит из <IdempotencyField/> в форме.
//     headers: idempotencyHeaders(ctx.idempotencyKey),
//   });
//   if (error) rethrowApiError(error);
//   revalidateEntity("entities");
//   return data;
// });
```

И в шапке-комментарии шага «4. createApiClient() + вызов бекенда» дописать строку:

```ts
 * 4. createApiClient() + вызов бекенда (для мутаций — headers: idempotencyHeaders(ctx.idempotencyKey))
```

- [ ] **Step 2: Добавить раздел в `docs/frontend-conventions.md`**

Добавить новый раздел (разместить рядом с разделом про формы / `createFormAction`):

````markdown
## Идемпотентность мутирующих форм (опционально)

Бекенд принимает заголовок `Idempotency-Key` на мутирующих ручках: повтор с тем же
ключом и **байт-идентичным** телом не применяется второй раз (Stripe-семантика).
Это backstop поверх анти-дабл-сабмита в UI — закрывает дыры, которые `disabled`
не закрывает: формы без JS, окно до гидрации, повтор после потери ответа.

**Это opt-in per-form, не глобально.** Не вешать на транспорт middleware: она минтит
свежий ключ на каждый запрос → нулевая защита. Ключ принадлежит «одному намерению»,
им владеет компонент формы.

**Как включить форму:**

1. В форму (`"use client"`) внутрь `<Form>` добавить `<IdempotencyField result={state} />`
   из `@/components/ui` (`state` — из `useActionState`). Он рендерит скрытое поле,
   держит ключ стабильным и ротирует его после успеха.
2. В server action принять второй аргумент `ctx` и пробросить заголовок:

   ```ts
   export const createX = createFormAction(async (formData, ctx) => {
     // …
     const { data, error } = await api.POST("/api/…", {
       params,
       body,
       headers: idempotencyHeaders(ctx.idempotencyKey), // @/utils/idempotency
     });
     // …
   });
   ```

   Для слайсов на прямом `fetch` (не openapi-fetch, напр. annotations) —
   разворачивать тот же объект в `headers`:
   `headers: { ...base, ...idempotencyHeaders(ctx.idempotencyKey) }`.

**Политика ключа** (в `<IdempotencyField>`): стабилен на время жизни формы (двойной
клик и повтор-после-ошибки шлют тот же ключ → реплей, не дубль); ротируется после
каждого успешного сабмита (иначе следующая, уже другая, мутация словит 422 REUSED).

**Ошибки** (тексты — централизованы в `rethrowApiError`): 409 `IDEMPOTENCY_KEY_IN_USE`
(параллельный запрос ещё в работе), 422 `IDEMPOTENCY_KEY_REUSED` (тот же ключ + другое
тело), 400 `IDEMPOTENCY_KEY_INVALID`.

**Известный edge:** success + потеря ответа + правка тела + повтор → 422 REUSED
(бэк уже закешировал первый success). Узкий (не-2xx не кэшируется), показывается
дружелюбным текстом — отдельной обработки в форме не требуется.

**Кому НЕ нужно:** PUT/DELETE-by-id уже идемпотентны по эффекту; ручки, которые бэк
ещё не покрыл (заголовок безвреден, но смысла нет — включать по мере покрытия).
````

- [ ] **Step 3: Lint docs/template (нет кода — только типчек на template)**

Run: `pnpm typecheck`
Expected: 0 ошибок (шаблон содержит только комментарии + `_placeholder`).

- [ ] **Step 4: Commit**

```bash
git add src/features/_template/actions.ts docs/frontend-conventions.md
git commit -m "docs(idempotency): conventions + template example for opting forms in"
```

---

## Final Gate

- [ ] **Полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: lint 0, все тесты зелёные (база + ~14 новых), build OK.

---

## Self-Review

**1. Spec coverage:**
- «Не транспортная middleware, ключ на уровне намерения» → Task 4 (компонент формы) + Task 2 (контекст). ✓
- «Стабилен + ротация на успехе» → Task 4 + тесты ротации. ✓
- «422/409/400 дружелюбно» → Task 3. ✓
- «Per-form opt-in, не глобально» → Task 5 (один адаптер) + Task 6 (чеклист). ✓
- «Foundation-зона отдельным PR» → весь план — один PR в foundation-зоне. ✓
- «Известный edit-422 edge задокументирован» → Task 3 (текст) + Task 4/6 (доки). ✓

**2. Placeholder scan:** код приведён целиком в каждом шаге; команды и ожидаемый результат указаны. ✓

**3. Type consistency:** имена согласованы между тасками — `IDEMPOTENCY_FIELD` / `IDEMPOTENCY_HEADER` / `readIdempotencyKey` / `idempotencyHeaders` (Task 1) используются в Task 2/4/5; `FormActionContext.idempotencyKey` (Task 2) читается в Task 5 как `ctx.idempotencyKey`; компонент `IdempotencyField` (Task 4) импортируется в Task 5. ✓

---

## После PR (follow-up, НЕ в этом PR)

- **Раскатка на остальные мутирующие формы** по чеклисту из `docs/frontend-conventions.md`. Кандидаты (формы на `createFormAction` + `api.POST/PUT`): trails, forms (submission), preferences, banners, share-links, glossary, documents, tags. Включать ту форму, чью ручку бэк покрыл `Idempotency-Key` (свериться с перегенерённой `src/api/schema.ts`). Это механический per-form диф (1 строка в форме + `headers` в action), можно субагентами по слайсу.
- **Annotations (прямой fetch):** добавить `...idempotencyHeaders(ctx.idempotencyKey)` в headers ручного `fetch` в `src/features/annotations/actions.ts` (онлайн-путь; офлайн-путь уже шлёт `clientId`).
- **Опциональное усиление от edit-422 edge:** если узкий кейс начнёт мешать — рассмотреть ключ как `hash(nonce + body)` (тогда правка тела авто-ротирует ключ). Сейчас YAGNI.
```

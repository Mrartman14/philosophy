# Type-Drift PR-A (FE-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать дрейф двух FE-типов от OpenAPI без единой правки бэка: `Capability` (#1) и `AttachmentEntityType` (#3-FE), починив попутно латентный баг admin-гейта.

**Architecture:** `Capability` становится ре-экспортом сгенерированного `rbac.Capability` (4 фантома исчезают, появляется `banner.view_admin_audience`). Это ломает `tsc` в `admin/layout.tsx`, где использовались фантомы `lecture.update` и `admin.access` — гейт-логику выносим в тестируемый модуль `admin-access.ts` и чиним: `canAccessAdmin` = «есть хотя бы один админ-нав-итем». `AttachmentEntityType` ре-экспортируется из уже сгенерированного enum request-схемы attachment (бэк не нужен), инлайн-литералы мигрируются, Zod `ENTITY_TYPE` оборачивается двусторонним compile-time гардом.

**Tech Stack:** TypeScript (strict, `noUnusedLocals:true`), Next.js App Router (server components), Zod v4, Vitest. Спека: `docs/superpowers/specs/2026-06-13-fe-openapi-type-drift-design.md`.

**Зоны/правила:** PR-A — FE-only foundation-update. Трогает запретные зоны `src/utils/permissions.ts` и `src/app/admin/layout.tsx` (координированно, это и есть foundation-PR). Никаких `git add -A` — добавлять только перечисленные файлы по имени. Перед мержем зелёные: `npm run lint && npm test && npm run build`.

---

## File Structure

**Группа 1 — #1 Capability (foundation):**
- Modify: `src/api/types.ts` — добавить плоский ре-экспорт `Capability` (дом для schema-реэкспортов).
- Modify: `src/utils/permissions.ts:12-53` — заменить рукописный union на ре-экспорт.
- Create: `src/app/admin/admin-access.ts` — вынесенные `buildNavItems` + `canAccessAdmin` (чистые, тестируемые, без next-runtime импортов).
- Modify: `src/app/admin/layout.tsx` — импортировать гейт из `admin-access.ts`, удалить локальные копии и мёртвую ветку `lecture.update`.
- Create: `src/app/admin/admin-access.test.ts` — тесты гейта + инвариант «нав-cap ∩ RoleUser = ∅».

**Группа 2 — #3-FE AttachmentEntityType (lectures, feature):**
- Modify: `src/features/lectures/types.ts:30` — ре-экспорт из request-схемы.
- Modify: `src/features/lectures/actions.ts` — заменить 3 инлайн-литерала на `AttachmentEntityType`.
- Modify: `src/features/lectures/ui/lecture-attachments-manager.tsx` — заменить 3 инлайн-литерала.
- Modify: `src/features/lectures/schemas.ts:40` — обернуть `ENTITY_TYPE` двусторонним drift-гардом.

---

## Группа 1 — #1 Capability

### Task 1: Ре-экспорт `Capability` из сгенерированной схемы

**Files:**
- Modify: `src/api/types.ts` (после блока `// --- Users ---`, перед `// --- Push ---`)
- Modify: `src/utils/permissions.ts:1-53`

- [ ] **Step 1: Добавить плоский алиас в `@/api/types`**

В `src/api/types.ts` после строки `export type UserStatus = UserUpdateStatusRequest["status"];` (строка 36) вставить:

```ts

// --- RBAC ---
/** Полный реестр capability (генерируется из rbac.Capability). */
export type Capability = Schemas["rbac.Capability"];
```

- [ ] **Step 2: Заменить рукописный union в `permissions.ts` на ре-экспорт**

В `src/utils/permissions.ts` заменить весь блок объявления `Capability` (строки 1-53: текущий `import type { MaybeMe } from "./me";` остаётся; удаляется docstring + `export type Capability = | "lecture.create" | … | "admin.access";`) на:

```ts
import type { MaybeMe } from "./me";
import type { Capability } from "@/api/types";

/**
 * Реестр capability фронта — ре-экспорт сгенерированного `rbac.Capability`
 * (источник истины: бэк philosophy-api `internal/rbac/capabilities.go`).
 * Узкий union ловит опечатки и дрейф в `tsc`. НЕ редактировать руками —
 * после изменения RBAC на бэке прогнать `npm run generate:api`.
 *
 * Ownership-проверки («свой ли это комментарий») сюда не входят — они живут в
 * доменных хелперах `src/features/{name}/permissions.ts`. Status-гейт
 * (`active` vs `suspended/banned`) — глобальный, в `can()` ниже.
 */
export type { Capability };
```

Остальное в файле (`can`, `isMutationAllowed`, `DenyReason`, `ForbiddenError`, `requireCapability`) — без изменений.

- [ ] **Step 3: Прогнать tsc — убедиться, что всплыли ровно ожидаемые ошибки**

Run: `npx tsc --noEmit`
Expected: FAIL ровно в двух местах `src/app/admin/layout.tsx` — `can(me, "lecture.update")` (стр. 23) и `can(me, "admin.access")` (стр. 83): `Argument of type '"lecture.update"' is not assignable to parameter of type 'Capability'` (и аналогично `"admin.access"`). Других ошибок быть не должно (фантомы `lecture.upload_files`/`transcript.edit` нигде не использовались).

> Эти ошибки чинятся в Task 2-3 (перенос гейта + фикс логики). Коммит — после Task 3, когда tsc снова зелёный.

### Task 2: Вынести гейт в тестируемый модуль + падающий тест

**Files:**
- Create: `src/app/admin/admin-access.ts`
- Test: `src/app/admin/admin-access.test.ts`

- [ ] **Step 1: Создать `admin-access.ts` с перенесённой логикой (с фиксом)**

Создать `src/app/admin/admin-access.ts`:

```ts
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";
import type { NavItem } from "./admin-sidebar";

/**
 * Полный набор пунктов админки. Каждый пункт гейтится capability'ями: пока
 * фича не появилась и бекенд не выдаёт capability, пункт не показывается.
 *
 * ⚠️ Эти capability ОПРЕДЕЛЯЮТ admin-границу (см. `canAccessAdmin`). Не гейти
 * нав-итемы на user-capability (canvas.create / form.create / annotation.create
 * / comment.create / document.create / media.create / trail.create /
 * entity.attach) — иначе admin-shell молча откроется всем active-юзерам.
 * Инвариант проверяется тестом «нав-cap ∩ RoleUser = ∅».
 */
export function buildNavItems(me: MaybeMe): NavItem[] {
  const items: NavItem[] = [];
  if (can(me, "lecture.create") || can(me, "lecture.delete")) {
    items.push({ href: "/admin/lectures", label: "Лекции" });
  }
  if (
    can(me, "glossary.create") ||
    can(me, "glossary.update") ||
    can(me, "glossary.delete")
  ) {
    items.push({ href: "/admin/glossary", label: "Глоссарий" });
  }
  if (can(me, "tag.create") || can(me, "tag.update") || can(me, "tag.delete")) {
    items.push({ href: "/admin/tags", label: "Теги" });
  }
  if (can(me, "event.read")) {
    items.push({ href: "/admin/events", label: "События" });
  }
  if (can(me, "banner.read")) {
    items.push({ href: "/admin/banners", label: "Баннеры" });
  }
  if (can(me, "document.delete_any")) {
    items.push({ href: "/admin/documents", label: "Документы" });
  }
  if (can(me, "form.delete_any")) {
    items.push({ href: "/admin/forms", label: "Формы" });
  }
  if (can(me, "trail.delete_any")) {
    items.push({ href: "/admin/trails", label: "Маршруты" });
  }
  if (can(me, "share_link.moderate")) {
    items.push({ href: "/admin/share-links", label: "Ссылки" });
  }
  if (can(me, "comment.delete_any")) {
    items.push({ href: "/admin/comments", label: "Комментарии" });
  }
  if (can(me, "annotation.delete_any")) {
    items.push({ href: "/admin/annotations", label: "Аннотации" });
  }
  if (can(me, "user.list")) {
    items.push({ href: "/admin/users", label: "Пользователи" });
  }
  if (can(me, "push.send")) {
    items.push({ href: "/admin/push", label: "Push-уведомления" });
  }
  if (can(me, "audit.read")) {
    items.push({ href: "/admin/audit", label: "Аудит" });
  }
  return items;
}

/**
 * Гейт layout-уровня: пускает active-пользователя с любой админ-capability.
 * Производный от `buildNavItems` (пустой список ⇒ нет ни одного админ-права).
 * Status-гейт (suspended/banned) держится на `can()` внутри `buildNavItems`,
 * который режет не-`active` (см. `permissions.ts`).
 */
export function canAccessAdmin(me: MaybeMe): boolean {
  return buildNavItems(me).length > 0;
}
```

> Прим.: ветка «Лекции» теперь `lecture.create || lecture.delete` (мёртвая `lecture.update` удалена — на бэке такого capability нет). `canAccessAdmin` больше не зовёт несуществующий `admin.access`.

- [ ] **Step 2: Написать падающий тест гейта**

Создать `src/app/admin/admin-access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Me } from "@/utils/me";
import { buildNavItems, canAccessAdmin } from "./admin-access";

const guest = null;

// Полный набор RoleAdmin (зеркало philosophy-api rbac/capabilities.go RoleAdmin).
const admin: Me = {
  id: "a1",
  username: "admin",
  role: "admin",
  status: "active",
  capabilities: [
    "lecture.create", "lecture.delete", "media.create", "media.delete_any",
    "comment.delete_any", "comment.create", "annotation.delete_any",
    "user.list", "user.moderate", "push.send",
    "glossary.create", "glossary.update", "glossary.delete", "audit.read",
    "tag.create", "tag.update", "tag.delete", "tag.assign",
    "document.create", "document.delete_any", "trail.create", "trail.delete_any",
    "annotation.create", "entity.attach", "share_link.moderate",
    "event.read", "event.create", "event.update", "event.delete",
    "banner.read", "banner.create", "banner.update", "banner.delete",
    "banner.view_admin_audience", "form.create", "form.delete_any",
    "canvas.create", "canvas.delete_any",
  ],
};

// Полный набор RoleUser (зеркало rbac/capabilities.go RoleUser).
const ROLE_USER_CAPS = [
  "document.create", "media.create", "trail.create", "annotation.create",
  "comment.create", "entity.attach", "form.create", "canvas.create",
] as const;

const plainUser: Me = {
  id: "u1",
  username: "user",
  role: "user",
  status: "active",
  capabilities: [...ROLE_USER_CAPS],
};

const suspendedAdmin: Me = { ...admin, status: "suspended" };

describe("canAccessAdmin", () => {
  it("гость → false", () => expect(canAccessAdmin(guest)).toBe(false));
  it("обычный active-юзер (только RoleUser-капы) → false", () =>
    expect(canAccessAdmin(plainUser)).toBe(false));
  it("suspended админ → false", () =>
    expect(canAccessAdmin(suspendedAdmin)).toBe(false));
  it("active админ → true", () => expect(canAccessAdmin(admin)).toBe(true));
});

describe("buildNavItems", () => {
  it("гость → пусто", () => expect(buildNavItems(guest)).toHaveLength(0));
  it("обычный active-юзер → пусто", () =>
    expect(buildNavItems(plainUser)).toHaveLength(0));
  it("админ → есть пункты", () =>
    expect(buildNavItems(admin).length).toBeGreaterThan(0));
});
```

- [ ] **Step 3: Прогнать тест — убедиться, что он падает по правильной причине**

Run: `npx vitest run src/app/admin/admin-access.test.ts`
Expected: на этом шаге тест уже должен ПРОЙТИ, если Task 2 Step 1 выполнен (модуль создан с финальной логикой). Если выполнять строго TDD — сначала создать `admin-access.ts` со старой логикой (`canAccessAdmin` через `can(me,"admin.access")`), тогда тест «active админ → true» ПАДАЕТ (admin.access нет в капах). Затем заменить на финальную логику → проходит. Допустимы оба порядка; ключевое — тест зелёный после Step 1.

### Task 3: Переключить layout.tsx на вынесенный модуль

**Files:**
- Modify: `src/app/admin/layout.tsx:1-94`

- [ ] **Step 1: Заменить шапку импортов и удалить локальные `buildNavItems`/`canAccessAdmin`**

В `src/app/admin/layout.tsx`:
1. Заменить импорты (стр. 1-6) на:

```ts
// src/app/admin/layout.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import { AdminSidebar } from "./admin-sidebar";
import { buildNavItems, canAccessAdmin } from "./admin-access";
```

2. Удалить целиком блок локальных функций (бывшие стр. 10-84: docstring + `function buildNavItems(...) {...}` + docstring + `function canAccessAdmin(...) {...}`). Оставить `export const metadata = { title: "Админ-панель" };` и `export default async function AdminLayout(...)` без изменений тела.

> `MaybeMe`, `can`, `NavItem` больше не импортируются в layout.tsx (они переехали в admin-access.ts) — это убирает потенциальные unused-import ошибки.

- [ ] **Step 2: Прогнать tsc — зелёный**

Run: `npx tsc --noEmit`
Expected: PASS (ошибки из Task 1 Step 3 устранены; `admin.access`/`lecture.update` больше не используются).

- [ ] **Step 3: Прогнать тест гейта — зелёный**

Run: `npx vitest run src/app/admin/admin-access.test.ts`
Expected: PASS (все describe-блоки).

- [ ] **Step 4: Коммит #1**

```bash
git add src/api/types.ts src/utils/permissions.ts src/app/admin/admin-access.ts src/app/admin/admin-access.test.ts src/app/admin/layout.tsx
git commit -m "fix(rbac): Capability = re-export rbac.Capability; fix admin gate

- убраны 4 фантомных capability (lecture.update/upload_files, transcript.edit, admin.access)
- canAccessAdmin больше не зависит от несуществующего admin.access (был всегда false)
- гейт вынесен в admin-access.ts + покрыт тестом

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 4: Инвариант «нав-cap ∩ RoleUser = ∅»

**Files:**
- Modify: `src/app/admin/admin-access.test.ts`

- [ ] **Step 1: Добавить инвариант-тест**

В конец `src/app/admin/admin-access.test.ts` добавить:

```ts
describe("инвариант связности гейта: нав-cap ∩ RoleUser = ∅", () => {
  // Если кто-то загейтит нав-итем на user-capability, юзер с этим капом
  // получит непустой buildNavItems → откроется admin-shell. Этот тест ловит
  // такое: ни одна capability из RoleUser не должна давать пункт меню.
  it("ни один RoleUser-кап не порождает нав-итем", () => {
    for (const cap of ROLE_USER_CAPS) {
      const probe: Me = {
        id: "p",
        username: "probe",
        role: "user",
        status: "active",
        capabilities: [cap],
      };
      expect(buildNavItems(probe), `cap ${cap} не должен давать нав-итем`).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Прогнать — зелёный**

Run: `npx vitest run src/app/admin/admin-access.test.ts`
Expected: PASS. (Сегодня пересечение пустое; тест защищает от будущего дрейфа.)

- [ ] **Step 3: Коммит**

```bash
git add src/app/admin/admin-access.test.ts
git commit -m "test(admin): инвариант нав-cap ∩ RoleUser = ∅

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Группа 2 — #3-FE AttachmentEntityType

### Task 5: Ре-экспорт `AttachmentEntityType` из request-схемы

**Files:**
- Modify: `src/features/lectures/types.ts:29-30`

- [ ] **Step 1: Заменить рукописный литерал на ре-экспорт**

В `src/features/lectures/types.ts` заменить строки 29-30:

```ts
/** Тип прикрепляемой сущности. canvas валиден на беке, просмотра нет (§4 спеки). */
export type AttachmentEntityType = "document" | "media" | "canvas";
```

на:

```ts
/**
 * Тип прикрепляемой сущности. Ре-экспорт сгенерированного enum из request-схемы
 * attachment (`validate:"oneof=document media canvas"` на бэке). canvas валиден
 * на беке, отдельного просмотра нет (§4 спеки). НЕ редактировать руками.
 */
export type AttachmentEntityType =
  components["schemas"]["attachment.CreateAttachmentRequest"]["entity_type"];
```

> `import type { components } from "@/api/schema";` уже есть в файле (стр. 3). Множество значений тождественно прежнему (`document|media|canvas`), поэтому downstream-код не ломается.

- [ ] **Step 2: Прогнать tsc — зелёный**

Run: `npx tsc --noEmit`
Expected: PASS (тип идентичен по значениям).

### Task 6: Мигрировать инлайн-литералы на `AttachmentEntityType`

**Files:**
- Modify: `src/features/lectures/actions.ts:33` (импорт) + `:173,:203,:306`
- Modify: `src/features/lectures/ui/lecture-attachments-manager.tsx:20,:71,:76`

- [ ] **Step 1: actions.ts — расширить импорт типа**

В `src/features/lectures/actions.ts` заменить строку 33:

```ts
import type { Lecture } from "./types";
```

на:

```ts
import type { Lecture, AttachmentEntityType } from "./types";
```

- [ ] **Step 2: actions.ts — заменить 3 инлайн-литерала**

Заменить КАЖДОЕ из трёх вхождений (стр. 173, 203, 306):

```ts
    entity_type: "document" | "media" | "canvas";
```

на:

```ts
    entity_type: AttachmentEntityType;
```

(Используй `Edit` с `replace_all: true` для точного совпадения строки `    entity_type: "document" | "media" | "canvas";`.)

- [ ] **Step 3: manager.tsx — импорт типа**

В `src/features/lectures/ui/lecture-attachments-manager.tsx` после блока импортов (после строки 15 `} from "../actions";`) добавить:

```ts
import type { AttachmentEntityType } from "../types";
```

- [ ] **Step 4: manager.tsx — заменить 3 инлайн-литерала**

- Строка 20 (`interface ManagedAttachment`): `entityType: "document" | "media" | "canvas";` → `entityType: AttachmentEntityType;`
- Строка 71 (return-тип `split`): `entityType: "document" | "media" | "canvas";` → `entityType: AttachmentEntityType;`
- Строка 76 (каст внутри `split`): `entityType: id.slice(0, idx) as "document" | "media" | "canvas",` → `entityType: id.slice(0, idx) as AttachmentEntityType,`

> Строка 32 (`pickerEntityType: "document" | "media";`) — НЕ трогать: это сознательно более узкое множество (пикер не прикрепляет canvas), не равно `AttachmentEntityType`.

- [ ] **Step 5: Прогнать tsc — зелёный**

Run: `npx tsc --noEmit`
Expected: PASS.

### Task 7: Двусторонний drift-гард для Zod `ENTITY_TYPE`

**Files:**
- Modify: `src/features/lectures/schemas.ts:40`

- [ ] **Step 1: Обернуть `ENTITY_TYPE` гардом**

В `src/features/lectures/schemas.ts`:
1. После `import { z } from "zod";` (стр. 3) добавить:

```ts
import type { AttachmentEntityType } from "./types";
```

2. Заменить строку 40:

```ts
const ENTITY_TYPE = z.enum(["document", "media", "canvas"]);
```

на:

```ts
// drift-гард: ключи обязаны ТОЧНО совпадать с AttachmentEntityType (обе стороны).
// `satisfies Record<AttachmentEntityType, true>` валит tsc, если бэк добавит/уберёт
// значение, а этот набор отстанет. См. spec §«Рантайм-нюанс».
const ENTITY_TYPE_SET = {
  document: true,
  media: true,
  canvas: true,
} as const satisfies Record<AttachmentEntityType, true>;

const ENTITY_TYPE = z.enum(
  Object.keys(ENTITY_TYPE_SET) as [AttachmentEntityType, ...AttachmentEntityType[]],
);
```

- [ ] **Step 2: Прогнать tsc + проверить, что гард реально ловит дрейф**

Run: `npx tsc --noEmit`
Expected: PASS.

Затем временно сломать набор для проверки гарда — убрать `canvas: true,` из `ENTITY_TYPE_SET`:
Run: `npx tsc --noEmit`
Expected: FAIL — `Property 'canvas' is missing in type '{ document: true; media: true; }' but required in type 'Record<AttachmentEntityType, true>'`.
Затем **вернуть `canvas: true,` обратно** и снова `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Прогнать существующие тесты lectures (поведение схем не изменилось)**

Run: `npx vitest run src/features/lectures`
Expected: PASS (значения enum те же — document/media/canvas; `LectureAttachSchema`/`Detach`/`Reorder` принимают/отклоняют те же входы).

- [ ] **Step 4: Коммит**

```bash
git add src/features/lectures/types.ts src/features/lectures/actions.ts src/features/lectures/ui/lecture-attachments-manager.tsx src/features/lectures/schemas.ts
git commit -m "refactor(lectures): AttachmentEntityType = re-export + drift-guard Zod

- AttachmentEntityType ре-экспортируется из сгенерированной request-схемы (0 правок бэка)
- инлайн-литералы document|media|canvas заменены на тип
- ENTITY_TYPE обёрнут двусторонним compile-time гардом

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Финальная верификация PR-A

- [ ] **Step 1: Полный прогон**

```bash
npm run lint && npm test && npm run build
```
Expected: всё зелёное.

- [ ] **Step 2: Sanity — фантомы исчезли, дрейф закрыт**

Run: `grep -rn 'admin\.access\|lecture\.update\|lecture\.upload_files\|transcript\.edit' src/ | grep -v schema.ts`
Expected: пусто (ни одного использования фантомов).

---

## Связь с PR-B

PR-A полностью независим (0 правок бэка, ландится первым). FE-ре-экспорт `ParentEntityType` (annotations, #2) и response-симметрия attachment (#3-бэк) — в плане PR-B (`2026-06-13-type-drift-pr-b-backend-regen.md`), т.к. требуют правок Go + регенерации `schema.ts`.

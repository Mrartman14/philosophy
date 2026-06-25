# Anchored Comments Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю на `/lectures/[id]` оставлять комментарий к выделенному фрагменту инлайн-документа: выделение → создать заякоренный комментарий; прокомментированный текст подсвечивается по hover/тоглу; клик по фрагменту → превью-карточка корневого комментария в ЛЕВОМ поле + кнопка «к треду».

**Architecture:** Заякоренный комментарий — обычный комментарий лекции (`lecture_id`) с опциональным `anchor`, указывающим `target_entity_type="document"` + `target_entity_id=<inline doc>` + координаты фрагмента. Фронт ставит на движок `anchor-engine` из PR1: коннектор `DocumentCommentLayer` использует `InlineAnchorLayer` (lazy + hover). Заякоренные комментарии при этом продолжают жить и в нижнем треде (`CommentSection`) — read-путь read-only там уже работает.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, Vitest + jsdom, pnpm, CSS Custom Highlight API, next-intl (i18n).

## Global Constraints

- **PR1 (`2026-06-26-anchor-engine-foundation.md`) уже смержен и прошёл браузер-QA аннотаций.** Этот план потребляет `InlineAnchorLayer`, `useHoverReveal`, `@/utils/text-anchor`, `@/utils/anchor-json` из PR1.
- **Пакетный менеджер — pnpm.** Команды: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm vitest run <path>`.
- **Финальный гейт перед PR — зелёные `pnpm lint && pnpm test && pnpm build`.**
- **i18n-паритет:** новые ключи добавлять во ВСЕ локали `src/i18n/messages/{ru,en,ar,zh}/comments.ts` в одном таске, иначе ICU-parity тест падает. Псевдолокаль `en-XA` генерируется автоматически.
- **Scope v1:** якорь только на инлайн-документ (`target_entity_type="document"`). glossary/media/comment — НЕ в этой итерации.
- **RBAC:** создание — существующий `canCreateComment`. Без новых capability.
- **Имена файлов в `src/` — kebab-case.** Не трогать `src/api/schema.ts`.
- **Параллельные агенты:** `git add <свои файлы>`; не `git add -A`; без деструктивных git. Коммит `git add <files> && git commit --only <те же files>`.
- **Субагенты — на модели opus.**
- TDD, DRY, YAGNI, частые коммиты.

---

## File Structure

```
src/features/comments/
  types.ts                              + export type Anchor (comment.Anchor)
  anchor.ts                             NEW — buildCommentTextAnchor(textAnchor, documentId)
  anchored.ts                           NEW — selectAnchoredRoots(subtrees, documentId) (pure)
  schemas.ts                            + anchor-field в makeCommentCreateSchema (через @/utils/anchor-json)
  actions.ts                            + anchor в body createComment
  ui/comment-anchored-create-form.tsx   NEW — форма создания из выделения (type + body + hidden anchor)
  ui/comment-composer-dialog.tsx        NEW — модалка-композер (цитата + форма)
  ui/comment-preview-card.tsx           NEW — превью корневого коммента + кнопка «к треду» (server)
  ui/open-thread-button.tsx             NEW — client-кнопка: скролл к #comment-<id>
  ui/document-comment-layer.tsx         NEW — client-коннектор на InlineAnchorLayer
  ui/document-comments.tsx              NEW — server-сборщик (fetch + filter + provider)
  ui/comment-tree.tsx                   + scroll-target id на узле
  index.ts                              + export DocumentComments
src/app/lectures/[id]/page.tsx          + левый MarginNote с DocumentComments
src/app/globals.css                     + ::highlight(comment) / ::highlight(comment-active)
src/i18n/messages/{ru,en,ar,zh}/comments.ts  + ключи маргиналии комментов
```

---

## Interfaces (контракт между тасками)

```ts
// из PR1 — @/utils/text-anchor
import { coordsToEngineAnchor, engineAnchorToCoords } from "@/utils/text-anchor";
// из PR1 — @/utils/anchor-json
import { anchorJsonField } from "@/utils/anchor-json";
// из PR1 — @/components/anchor-engine
import { InlineAnchorLayer, type AnchoredNote, type AnchorDraft } from "@/components/anchor-engine";

// comments/types.ts
export type Anchor = components["schemas"]["comment.Anchor"];
//   = coords (start_block_id, end_char, exact, prefix, suffix, start_sec, end_sec)
//     + target_entity_type: "document"|"glossary"|"comment"|"media"  (required)
//     + target_entity_id: string                                     (required)

// comments/anchor.ts
export function buildCommentTextAnchor(a: TextAnchor, documentId: string): Anchor;
//   target_entity_type="document", target_entity_id=documentId, + координаты из engineAnchorToCoords(a)

// comments/anchored.ts
export interface AnchoredRoot {
  id: string;          // root.id
  anchor: Anchor;      // root.anchor (text-range, target document)
  root: Comment;       // корневой комментарий
  replyCount: number;  // descendants.length
}
export function selectAnchoredRoots(subtrees: RootSubtree[], documentId: string): AnchoredRoot[];

// comments/ui/document-comments.tsx (server)
export function DocumentComments(props: { lectureId: string; documentId: string }): Promise<ReactNode>;

// comments/ui/document-comment-layer.tsx (client)
export interface DocumentCommentNote { id: string; anchor: Anchor; preview: ReactNode; }
export interface DocumentCommentLayerProps {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: DocumentCommentNote[];
  canCreate: boolean;
}
export function DocumentCommentLayer(props: DocumentCommentLayerProps): ReactNode;
```

---

### Task 1: Тип `Anchor` + билдер `buildCommentTextAnchor`

Доменный якорь комментария = координаты + обязательные target-поля. Билдер доинжектит `target_entity_type="document"` + `target_entity_id` к координатам из движкового `TextAnchor`.

**Files:**
- Modify: `src/features/comments/types.ts` (+ export `Anchor`)
- Create: `src/features/comments/anchor.ts`
- Create (test): `src/features/comments/anchor.test.ts`

**Interfaces:**
- Consumes: `engineAnchorToCoords` (`@/utils/text-anchor`), `TextAnchor` (`@/components/anchor-engine`).
- Produces: `buildCommentTextAnchor`, тип `Anchor`.

- [ ] **Step 1: Добавить тип `Anchor` в `types.ts`**

После строки с `export type Comment = ...` добавить:

```ts
/** Якорь комментария: координаты фрагмента + цель (target_entity_*). */
export type Anchor = components["schemas"]["comment.Anchor"];
```

- [ ] **Step 2: Написать падающий тест `anchor.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { buildCommentTextAnchor } from "./anchor";

describe("buildCommentTextAnchor", () => {
  it("строит comment.Anchor с target=document и координатами", () => {
    expect(
      buildCommentTextAnchor(
        { startBlockId: "b1", endBlockId: "b2", startChar: 3, endChar: 7, exact: "слово", prefix: "до ", suffix: " после" },
        "doc-123",
      ),
    ).toEqual({
      target_entity_type: "document",
      target_entity_id: "doc-123",
      start_block_id: "b1",
      end_block_id: "b2",
      start_char: 3,
      end_char: 7,
      exact: "слово",
      prefix: "до ",
      suffix: " после",
    });
  });

  it("опускает пустые prefix/suffix", () => {
    const a = buildCommentTextAnchor(
      { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 2, exact: "ab" },
      "doc-1",
    );
    expect(a.prefix).toBeUndefined();
    expect(a.suffix).toBeUndefined();
  });
});
```

- [ ] **Step 3: Прогнать — падает**

Run: `pnpm vitest run src/features/comments/anchor.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 4: Реализовать `anchor.ts`**

```ts
// src/features/comments/anchor.ts
// Билдер якоря комментария из движкового TextAnchor. Координаты переиспользуют
// общий конвертер; target-поля (target_entity_type/id) — доменная специфика
// комментария (см. docs/.../2026-06-26-anchored-comments-design.md): комментарий
// висит на lecture_id, anchor указывает на фрагмент под-сущности (v1 — document).
import { engineAnchorToCoords } from "@/utils/text-anchor";
import type { TextAnchor } from "@/components/anchor-engine";

import type { Anchor } from "./types";

/** v1: якорь только на инлайн-документ лекции. */
export function buildCommentTextAnchor(a: TextAnchor, documentId: string): Anchor {
  return {
    target_entity_type: "document",
    target_entity_id: documentId,
    ...engineAnchorToCoords(a),
  };
}
```

- [ ] **Step 5: Прогнать — проходит**

Run: `pnpm vitest run src/features/comments/anchor.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/comments/types.ts src/features/comments/anchor.ts src/features/comments/anchor.test.ts
git commit --only src/features/comments/types.ts src/features/comments/anchor.ts src/features/comments/anchor.test.ts -m "feat(comments): билдер buildCommentTextAnchor (target=document)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure-фильтр `selectAnchoredRoots`

Из subtrees лекции выбрать корни, заякоренные на ТЕКУЩИЙ документ валидным text-range. Только корни (anchored-комментарий — корень треда в модели v1).

**Files:**
- Create: `src/features/comments/anchored.ts`
- Create (test): `src/features/comments/anchored.test.ts`

**Interfaces:**
- Consumes: `coordsToEngineAnchor` (`@/utils/text-anchor`), типы `RootSubtree`/`Comment`/`Anchor`.
- Produces: `selectAnchoredRoots`, тип `AnchoredRoot`.

- [ ] **Step 1: Написать падающий тест `anchored.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { selectAnchoredRoots } from "./anchored";
import type { RootSubtree } from "./types";

const textAnchor = (docId: string) => ({
  target_entity_type: "document" as const,
  target_entity_id: docId,
  start_block_id: "b1",
  end_block_id: "b1",
  start_char: 0,
  end_char: 3,
  exact: "abc",
});

describe("selectAnchoredRoots", () => {
  it("берёт корни с text-якорем на нужный документ + считает ответы", () => {
    const subtrees: RootSubtree[] = [
      {
        root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim", anchor: textAnchor("doc-1") },
        descendants: [
          { id: "c2", created_at: "", updated_at: "", lecture_id: "L", type: "grounds", parent_id: "c1" },
        ],
      },
    ];
    const r = selectAnchoredRoots(subtrees, "doc-1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "c1", replyCount: 1 });
    expect(r[0]?.anchor.target_entity_id).toBe("doc-1");
  });

  it("отсеивает чужой документ", () => {
    const subtrees: RootSubtree[] = [
      { root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim", anchor: textAnchor("doc-OTHER") }, descendants: [] },
    ];
    expect(selectAnchoredRoots(subtrees, "doc-1")).toHaveLength(0);
  });

  it("отсеивает корни без якоря и media-якоря", () => {
    const subtrees: RootSubtree[] = [
      { root: { id: "c1", created_at: "", updated_at: "", lecture_id: "L", type: "claim" }, descendants: [] },
      {
        root: {
          id: "c2", created_at: "", updated_at: "", lecture_id: "L", type: "claim",
          anchor: { target_entity_type: "media", target_entity_id: "m1", start_sec: 1, end_sec: 2 },
        },
        descendants: [],
      },
    ];
    expect(selectAnchoredRoots(subtrees, "doc-1")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/features/comments/anchored.test.ts`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `anchored.ts`**

```ts
// src/features/comments/anchored.ts
// Pure-выборка заякоренных корней под текущий документ. Заякоренный комментарий
// в v1 — корень треда (anchor на root). Фильтр: target=document текущего дока +
// валидный text-range (movement-якорь резолвится). replyCount = число потомков.
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import type { Anchor, Comment, RootSubtree } from "./types";

export interface AnchoredRoot {
  id: string;
  anchor: Anchor;
  root: Comment;
  replyCount: number;
}

export function selectAnchoredRoots(subtrees: RootSubtree[], documentId: string): AnchoredRoot[] {
  const out: AnchoredRoot[] = [];
  for (const st of subtrees) {
    const root = st.root;
    const anchor = root?.anchor;
    if (!root?.id || !anchor) continue;
    if (root.is_deleted) continue; // удалённый корень → пустое тело, не показываем превью
    if (anchor.target_entity_type !== "document" || anchor.target_entity_id !== documentId) continue;
    if (coordsToEngineAnchor(anchor) === null) continue; // не text-range / неполный
    out.push({
      id: root.id,
      anchor,
      root,
      replyCount: (st.descendants ?? []).length,
    });
  }
  return out;
}
// ВНИМАНИЕ (осознанный YAGNI v1): берём anchor ТОЛЬКО с корня треда. Бэк
// допускает anchor на любом comment (descendants[].anchor) — такие заякоренные
// ответы read-путём здесь НЕ подсвечиваются (живут только в нижнем треде). См.
// бэк-аск в Task 12 (инвариант anchor-only-on-root).
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/features/comments/anchored.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/comments/anchored.ts src/features/comments/anchored.test.ts
git commit --only src/features/comments/anchored.ts src/features/comments/anchored.test.ts -m "feat(comments): selectAnchoredRoots — выбор заякоренных корней под документ

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `anchor` в схеме создания + в теле `createComment`

Расширить `makeCommentCreateSchema` опциональным `anchor` (общий `anchorJsonField` из PR1) и слать его в body. Незаякоренный путь (нижняя форма) не ломается — `anchor` опционален.

**Files:**
- Modify: `src/features/comments/schemas.ts`
- Modify: `src/features/comments/actions.ts`
- Create (test): `src/features/comments/schemas.test.ts`

**Interfaces:**
- Consumes: `anchorJsonField` (`@/utils/anchor-json`), `Anchor` (`./types`).
- Produces: `CommentCreateInput.anchor?` присутствует; `createComment` шлёт `body.anchor`.

- [ ] **Step 1: Написать падающий тест `schemas.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { makeCommentCreateSchema } from "./schemas";

// Минимальный t-стаб: возвращает ключ.
const t = ((k: string) => k) as never;

describe("makeCommentCreateSchema anchor", () => {
  const schema = makeCommentCreateSchema(t);

  it("парсит anchor JSON в объект и кладёт в выход", () => {
    const r = schema.parse({
      type: "claim",
      blocks: JSON.stringify([{ type: "paragraph", content: [] }]),
      anchor: JSON.stringify({ target_entity_type: "document", target_entity_id: "d1", start_block_id: "b1" }),
    });
    expect(r.anchor).toMatchObject({ target_entity_id: "d1" });
  });

  it("без anchor — поле отсутствует в выходе", () => {
    const r = schema.parse({
      type: "claim",
      blocks: JSON.stringify([{ type: "paragraph", content: [] }]),
    });
    expect("anchor" in r).toBe(false);
  });
});
```

- [ ] **Step 2: Прогнать — падает (anchor ещё не в схеме)**

Run: `pnpm vitest run src/features/comments/schemas.test.ts`
Expected: FAIL — `r.anchor` undefined / поле не парсится.

- [ ] **Step 3: Добавить anchor в `schemas.ts`**

В начало файла — импорт:

```ts
import { anchorJsonField } from "@/utils/anchor-json";
```

Заменить `makeCommentCreateSchema` (строки 29-42):

```ts
export function makeCommentCreateSchema(t: NamespaceT<"validation">) {
  return z
    .object({
      type: z.enum(COMMENT_TYPES, { message: t("comments.invalidType") }),
      blocks: makeBlocksJsonSchema(t),
      parent_id: z.uuid(t("comments.invalidParentId")).optional(),
      anchor: anchorJsonField({
        notObject: t("comments.anchorNotObject"),
        invalidJson: t("comments.anchorInvalidJson"),
      }),
    })
    .transform((raw) => ({
      type: raw.type,
      blocks: raw.blocks,
      ...(raw.parent_id ? { parent_id: raw.parent_id } : {}),
      ...(raw.anchor !== undefined ? { anchor: raw.anchor } : {}),
    }));
}
```

(Ключи `comments.anchorNotObject` / `comments.anchorInvalidJson` добавляются в Task 4.)

- [ ] **Step 4: Слать anchor в `createComment` (actions.ts)**

Добавить импорт `Anchor`:

```ts
import type { Anchor, ReactionAxis } from "./types";
```

В теле `createComment` (строки 66-74) расширить body:

```ts
  const { data, error } = await api.POST("/api/lectures/{id}/comments", {
    params: { path: { id: lectureId } },
    body: {
      type: input.type,
      blocks: input.blocks,
      ...(input.parent_id ? { parent_id: input.parent_id } : {}),
      // anchor приходит из формы как распарсенный объект; бек валидирует
      // (422 ANCHOR_INVALID). Каст на границе form-JSON → типизированное тело —
      // тот же паттерн, что у аннотаций (createAnnotation).
      ...(input.anchor !== undefined ? { anchor: input.anchor as Anchor } : {}),
    },
    headers: idempotencyHeaders(ctx.idempotencyKey),
  });
```

- [ ] **Step 5: Прогнать — схема зелёная, тесты комментов зелёные**

Run: `pnpm vitest run src/features/comments/schemas.test.ts`
Expected: PASS (после Task 4 i18n — если ключи нужны в рантайме теста, t-стаб возвращает ключ, поэтому тест зелёный уже сейчас).

Run: `pnpm vitest run src/features/comments`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/comments/schemas.ts src/features/comments/schemas.test.ts src/features/comments/actions.ts
git commit --only src/features/comments/schemas.ts src/features/comments/schemas.test.ts src/features/comments/actions.ts -m "feat(comments): опциональный anchor в схеме создания + теле createComment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: i18n-ключи (ДВА неймспейса: UI → comments, валидация → validation)

⚠️ **КРИТИЧНО (исправлено по ревью):** ключи якоря `anchorNotObject`/`anchorInvalidJson` резолвятся в схеме через `t: NamespaceT<"validation">` (Task 3: `t("comments.anchorNotObject")` → каталог **validation**, под-объект `comments:`). Поэтому они идут в `validation.ts`, НЕ в `comments.ts` — точно как у аннотаций (`src/i18n/messages/ru/validation.ts:143-144`, `annotations.anchorNotObject`). UI-строки маргиналии резолвятся через `useT("comments")`/`getT("comments")` → идут в `comments.ts`. `validation.ts` и `comments.ts` существуют во ВСЕХ 4 локалях; добавлять симметрично одним коммитом (иначе key-set parity падает). Псевдо `en-XA` генерируется.

**Files:**
- Modify: `src/i18n/messages/{ru,en,ar,zh}/comments.ts` (6 UI-ключей)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/validation.ts` (2 ключа якоря в под-объект `comments:`)

**Interfaces:**
- Produces (namespace `comments`): `marginCommentAdd`, `marginComposerTitle`, `marginHighlightShow`, `marginHighlightHide`, `marginOpenThread`, `marginColumnLabel`.
- Produces (namespace `validation`, под `comments:`): `anchorNotObject`, `anchorInvalidJson`.

- [ ] **Step 1: 6 UI-ключей в `comments.ts` каждой локали** (рядом с прочими ключами верхнего уровня)

`ru/comments.ts`:

```ts
  marginCommentAdd: "Комментировать",
  marginComposerTitle: "Комментарий к фрагменту",
  marginHighlightShow: "Показать комментарии в тексте",
  marginHighlightHide: "Скрыть комментарии в тексте",
  marginOpenThread: "Открыть обсуждение",
  marginColumnLabel: "Комментарии к фрагментам",
```

`en/comments.ts`:

```ts
  marginCommentAdd: "Comment",
  marginComposerTitle: "Comment on selection",
  marginHighlightShow: "Show comments in text",
  marginHighlightHide: "Hide comments in text",
  marginOpenThread: "Open thread",
  marginColumnLabel: "Comments on selections",
```

`ar/comments.ts` (RTL; машинный перевод, вычитка носителем follow-up):

```ts
  marginCommentAdd: "تعليق",
  marginComposerTitle: "تعليق على المقطع المحدد",
  marginHighlightShow: "إظهار التعليقات في النص",
  marginHighlightHide: "إخفاء التعليقات في النص",
  marginOpenThread: "فتح المناقشة",
  marginColumnLabel: "تعليقات على المقاطع المحددة",
```

`zh/comments.ts`:

```ts
  marginCommentAdd: "评论",
  marginComposerTitle: "对所选内容的评论",
  marginHighlightShow: "在正文中显示评论",
  marginHighlightHide: "在正文中隐藏评论",
  marginOpenThread: "打开讨论",
  marginColumnLabel: "对所选内容的评论",
```

- [ ] **Step 2: 2 ключа якоря в `validation.ts` каждой локали — в под-объект `comments:`** (рядом с `invalidType`/`blocksInvalidJson`, как `annotations.anchorNotObject` в том же файле)

`ru`: `anchorNotObject: "Якорь должен быть объектом",` `anchorInvalidJson: "Битый JSON в якоре",`
`en`: `anchorNotObject: "Anchor must be an object",` `anchorInvalidJson: "Invalid anchor JSON",`
`ar`: `anchorNotObject: "يجب أن يكون المرساة كائنًا",` `anchorInvalidJson: "صيغة JSON للمرساة غير صحيحة",`
`zh`: `anchorNotObject: "锚点必须是对象",` `anchorInvalidJson: "锚点 JSON 无效",`

- [ ] **Step 3: Прогнать i18n-тесты (паритет ключей по локалям + ICU-compile)**

Run: `pnpm test`
Expected: PASS — оба каталога симметричны по локалям. Проверь, что схема резолвит сообщение: `makeCommentCreateSchema(t).safeParse({type:"claim", blocks:"[]", anchor:"[1]"})` → ошибка с текстом `validation.comments.anchorNotObject`, не raw-ключ.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages/ru/comments.ts src/i18n/messages/en/comments.ts src/i18n/messages/ar/comments.ts src/i18n/messages/zh/comments.ts src/i18n/messages/ru/validation.ts src/i18n/messages/en/validation.ts src/i18n/messages/ar/validation.ts src/i18n/messages/zh/validation.ts
git commit --only src/i18n/messages/ru/comments.ts src/i18n/messages/en/comments.ts src/i18n/messages/ar/comments.ts src/i18n/messages/zh/comments.ts src/i18n/messages/ru/validation.ts src/i18n/messages/en/validation.ts src/i18n/messages/ar/validation.ts src/i18n/messages/zh/validation.ts -m "i18n(comments): UI-ключи маргиналии (comments) + ключи якоря (validation.comments)

ar/zh — машинный перевод, вычитка носителем follow-up.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Форма создания из выделения `CommentAnchoredCreateForm`

Зеркало `annotation-create-form.tsx`: тип + AST-тело + hidden `anchor` + hidden `lecture_id`; на успех — `onSuccess()` (закрыть модалку) + `router.refresh()`. Нижнюю `CommentCreateForm` НЕ трогаем (чтобы не менять её поведение).

**Files:**
- Create: `src/features/comments/ui/comment-anchored-create-form.tsx`

**Interfaces:**
- Consumes: `createComment` (`../actions`), `CommentCreateFormInput` (`../schemas`), `Anchor`/`CommentType` (`../types`), `LazyAstEditor` (`./lazy-ast-editor`).
- Produces: `CommentAnchoredCreateForm({ lectureId, rootTypes, anchor, onSuccess })`.

- [ ] **Step 1: Реализовать форму**

```tsx
"use client";
// src/features/comments/ui/comment-anchored-create-form.tsx
// Форма создания заякоренного комментария из выделения (selection-driven). Тип +
// AST-тело + скрытый anchor (JSON, уже с target_entity_*). На успех закрывает
// модалку (onSuccess) и обновляет страницу (router.refresh) — заякоренный
// комментарий появляется в нижнем треде, подсветка становится доступной.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import type { AstBlock } from "@/components/ast-editor";
import { createTypedForm, Form, FormFeedback, IdempotencyField, Select, Stack, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { createComment } from "../actions";
import type { CommentCreateFormInput } from "../schemas";
import type { Anchor, Comment, CommentType } from "../types";

import { LazyAstEditor } from "./lazy-ast-editor";

const initial = initialActionState<Comment | null>(null);
const { Field, f, errors } = createTypedForm<CommentCreateFormInput>();

interface Props {
  lectureId: string;
  rootTypes: CommentType[];
  anchor: Anchor;
  onSuccess: () => void;
}

export function CommentAnchoredCreateForm({ lectureId, rootTypes, anchor, onSuccess }: Props) {
  const router = useRouter();
  const t = useT("comments");
  const [blocks, setBlocks] = useState<AstBlock[]>([]);
  const [state, action] = useActionState(createComment, initial);

  const options = rootTypes.map((type) => ({ value: type, label: t(`type.${type}`) }));

  useEffect(() => {
    if (state.success && state.data) {
      onSuccess();
      router.refresh();
    }
  }, [state, router, onSuccess]);

  return (
    <Form action={action} errors={errors(state)}>
      <Stack>
        {/* lecture_id — path-параметр (action читает из FormData), не body-поле схемы. */}
        <input type="hidden" name="lecture_id" value={lectureId} />
        <input type="hidden" name={f("blocks")} value={JSON.stringify(blocks)} />
        <input type="hidden" name={f("anchor")} value={JSON.stringify(anchor)} />
        <IdempotencyField result={state} />

        <Field name="type" label={t("createTypeLabel")} required>
          <Select options={options} defaultValue={rootTypes[0] ?? ""} aria-label={t("createTypeAriaLabel")} />
        </Field>

        <Field name="blocks" label={t("createBodyLabel")} required>
          <LazyAstEditor
            entityContext="comment"
            defaultLectureId={lectureId}
            onChange={(next: AstBlock[]) => { setBlocks(next); }}
            ariaLabel={t("createBodyAriaLabel")}
          />
        </Field>

        <FormFeedback result={state} forbiddenAction={t("createForbiddenAction")} />
        <div>
          <SubmitButton>{t("createSubmit")}</SubmitButton>
        </div>
      </Stack>
    </Form>
  );
}
```

- [ ] **Step 2: Проверить сборку/линт**

Run: `pnpm lint && pnpm vitest run src/features/comments`
Expected: PASS (тип `CommentCreateFormInput` теперь содержит `anchor?: string`, `f("anchor")` валиден).

- [ ] **Step 3: Commit**

```bash
git add src/features/comments/ui/comment-anchored-create-form.tsx
git commit --only src/features/comments/ui/comment-anchored-create-form.tsx -m "feat(comments): CommentAnchoredCreateForm (создание из выделения)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Модалка-композер `CommentComposerDialog`

Зеркало `annotation-composer-dialog.tsx`: показывает цитату якоря (`CommentAnchorContext`) над формой.

**Files:**
- Create: `src/features/comments/ui/comment-composer-dialog.tsx`

**Interfaces:**
- Consumes: `Dialog` (`@/components/ui`), `CommentAnchoredCreateForm` (Task 5), `Anchor`/`CommentType` (`../types`).
- Produces: `CommentComposerDialog({ lectureId, rootTypes, open, onOpenChange, anchor })`.

> ⚠️ **Исправлено по ревью:** НЕ импортировать `CommentAnchorContext` — это `async` server-компонент (зовёт `getBlock`/`getT` из `server-only` `../api`); прямой рендер в `"use client"`-модуле НЕ собирается. Контекст-цитата здесь не нужна (пользователь только что сам выделил текст = `anchor.exact`). Используем штатный инлайн-бликвот (тот же паттерн, что `comment-node-view.tsx:93-97`).

- [ ] **Step 1: Реализовать диалог (инлайн-бликвот, без async-server)**

```tsx
"use client";
// src/features/comments/ui/comment-composer-dialog.tsx
// Модалка создания заякоренного комментария (selection-driven). Над формой —
// инлайн-цитата выделения (anchor.exact); форма закрывает диалог на успех.
import { Dialog } from "@/components/ui";
import { useT } from "@/i18n/client";

import type { Anchor, CommentType } from "../types";

import { CommentAnchoredCreateForm } from "./comment-anchored-create-form";

interface Props {
  lectureId: string;
  rootTypes: CommentType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: Anchor | undefined;
}

export function CommentComposerDialog({ lectureId, rootTypes, open, onOpenChange, anchor }: Props) {
  const t = useT("comments");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("marginComposerTitle")}>
      <div className="flex flex-col gap-4">
        {anchor?.exact && (
          <p className="border-s-2 border-(--color-border) ps-2 text-xs italic text-(--color-fg-muted)">
            {anchor.exact}
          </p>
        )}
        {anchor && (
          <CommentAnchoredCreateForm
            lectureId={lectureId}
            rootTypes={rootTypes}
            anchor={anchor}
            onSuccess={() => {
              onOpenChange(false);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Проверить сборку/линт**

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/comments/ui/comment-composer-dialog.tsx
git commit --only src/features/comments/ui/comment-composer-dialog.tsx -m "feat(comments): CommentComposerDialog (цитата + форма из выделения)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Превью-карточка `CommentPreviewCard` + `OpenThreadButton`

Превью корневого комментария в поле: тип + автор + тело + кнопка «к треду». Кнопка — client, скроллит к `#comment-<id>` в нижнем треде.

**Files:**
- Create: `src/features/comments/ui/open-thread-button.tsx`
- Create: `src/features/comments/ui/comment-preview-card.tsx`

**Interfaces:**
- Consumes: `AstRender` (`@/components/ast-render`), `CommentTypeBadge` (`./comment-type-badge`), `Comment` (`../types`), `Button` (`@/components/ui`).
- Produces: `OpenThreadButton({ commentId, label })`; `CommentPreviewCard({ comment, replyCount })` (server).

- [ ] **Step 1: Реализовать `open-thread-button.tsx`**

```tsx
"use client";
// src/features/comments/ui/open-thread-button.tsx
// Скроллит к корневому комментарию в нижнем треде (#comment-<id>). Узел треда
// несёт id=comment-<id> (см. comment-tree.tsx, Task 8). Уважает ось appearance
// motion (reduced → без анимации), как ast-toc.tsx — иначе регрессия reduced-motion.
import { useReducedMotion } from "@/components/appearance";
import { Button } from "@/components/ui";

export function OpenThreadButton({ commentId, label }: { commentId: string; label: string }) {
  const reduced = useReducedMotion();
  return (
    <Button
      type="button"
      compact
      tone="quiet"
      onClick={() => {
        const el = document.getElementById(`comment-${commentId}`);
        el?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }}
    >
      {label}
    </Button>
  );
}
```

> Примечание: `useReducedMotion` — из `@/components/appearance` (`src/components/appearance/use-reduced-motion.ts`), тот же хук, что в `ast-toc.tsx`. Если barrel `@/components/appearance` его не реэкспортит — импортировать из `@/components/appearance/use-reduced-motion`.

- [ ] **Step 2: Реализовать `comment-preview-card.tsx` (server)**

```tsx
// src/features/comments/ui/comment-preview-card.tsx
// Превью корневого заякоренного комментария в левом поле (по клику на фрагмент).
// Лёгкое: тип + автор + тело + кнопка «к треду». Полная дискуссия/ответы/реакции —
// в нижнем треде (CommentSection), куда ведёт OpenThreadButton.
import { AstRender } from "@/components/ast-render";
import { getT } from "@/i18n";

import type { Comment } from "../types";

import { CommentTypeBadge } from "./comment-type-badge";
import { OpenThreadButton } from "./open-thread-button";

export async function CommentPreviewCard({ comment, replyCount }: { comment: Comment; replyCount: number }) {
  const t = await getT("comments");
  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-fg-muted)">
        <CommentTypeBadge type={comment.type} label={t(`type.${comment.type}`)} />
        <span>{comment.author?.username ?? "—"}</span>
      </div>
      <div className="content" data-size="sm">
        <AstRender blocks={comment.blocks ?? []} />
      </div>
      <OpenThreadButton
        commentId={comment.id}
        label={replyCount > 0 ? `${t("marginOpenThread")} (${replyCount})` : t("marginOpenThread")}
      />
    </div>
  );
}
```

- [ ] **Step 3: Проверить сборку/линт**

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/features/comments/ui/open-thread-button.tsx src/features/comments/ui/comment-preview-card.tsx
git commit --only src/features/comments/ui/open-thread-button.tsx src/features/comments/ui/comment-preview-card.tsx -m "feat(comments): превью-карточка фрагмента + кнопка «к треду»

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Scroll-target id на узле нижнего треда

Чтобы `OpenThreadButton` находил корень, узел треда несёт `id="comment-<id>"`.

**Files:**
- Modify: `src/features/comments/ui/comment-tree.tsx`

- [ ] **Step 1: Добавить id на `<li>` узла в `Branch`**

В `comment-tree.tsx` строка 19 (`<li className="flex flex-col gap-2">`) заменить на:

```tsx
    <li id={`comment-${node.id}`} className="flex flex-col gap-2">
```

- [ ] **Step 2: Проверить, что дерево рендерится (существующие тесты комментов зелёные)**

Run: `pnpm vitest run src/features/comments`
Expected: PASS.

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/features/comments/ui/comment-tree.tsx
git commit --only src/features/comments/ui/comment-tree.tsx -m "feat(comments): scroll-target id=comment-<id> на узле треда

Цель для кнопки «к треду» из превью-карточки маргиналии.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Client-коннектор `DocumentCommentLayer`

Ставит `InlineAnchorLayer`: маппит доменные ноты → движковые (`coordsToEngineAnchor`), тогл подсветки (localStorage, default OFF), создание из выделения (`buildCommentTextAnchor` → композер), клик на узком экране → скролл к треду.

**Files:**
- Create: `src/features/comments/ui/document-comment-layer.tsx`
- Create (test): `src/features/comments/ui/document-comment-layer.test.tsx`

**Interfaces:**
- Consumes: `InlineAnchorLayer`/`AnchorDraft`/`AnchoredNote` (`@/components/anchor-engine`), `coordsToEngineAnchor` (`@/utils/text-anchor`), `buildCommentTextAnchor` (`../anchor`), `CommentComposerDialog` (Task 6), `Button`/`Inline` (`@/components/ui`).
- Produces: `DocumentCommentLayer` + типы `DocumentCommentNote`, `DocumentCommentLayerProps`.

- [ ] **Step 1: Написать падающий тест (lazy-инвариант + тогл-лейбл)**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentCommentLayer } from "./document-comment-layer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

const note = {
  id: "c1",
  anchor: {
    target_entity_type: "document" as const,
    target_entity_id: "doc-1",
    start_block_id: "b1",
    end_block_id: "b1",
    start_char: 0,
    end_char: 3,
    exact: "abc",
  },
  preview: <div>preview-c1</div>,
};

describe("DocumentCommentLayer", () => {
  it("рендерит тогл подсветки и НЕ показывает превью без клика", () => {
    render(
      <DocumentCommentLayer
        lectureId="L"
        documentId="doc-1"
        rootTypes={["claim"]}
        notes={[note]}
        canCreate={false}
      />,
    );
    // тогл присутствует (по дефолту OFF → лейбл "показать")
    expect(screen.getByText("marginHighlightShow")).toBeInTheDocument();
    // превью не отрендерено до клика
    expect(screen.queryByText("preview-c1")).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать — падает**

Run: `pnpm vitest run src/features/comments/ui/document-comment-layer.test.tsx`
Expected: FAIL — модуля нет.

- [ ] **Step 3: Реализовать `document-comment-layer.tsx`**

```tsx
"use client";
// src/features/comments/ui/document-comment-layer.tsx
// Коннектор движок↔домен (client) для заякоренных комментариев. Ставит lazy-
// политику InlineAnchorLayer: подсветка по hover/тоглу (default OFF — не
// конкурирует с аннотациями), клик по фрагменту → превью-карточка слева (wide)
// или скролл к нижнему треду (narrow). Создание из выделения: TextAnchor →
// buildCommentTextAnchor(+target document) → модалка-композер.
// SSR-расхождение с аннотациями (осознанно): превью-карточки НЕ в HTML — это
// progressive enhancement (контент дублирован в нижнем CommentSection). Поэтому
// слой монтируется client-only ({ready && ...}).
// A11y/тач (исправлено по ревью): hover-reveal недоступен с клавиатуры/тача, а
// CSS Custom Highlight не создаёт фокусируемых DOM-узлов. Поэтому при showAll
// рендерим ДОСТУПНЫЙ список заякоренных корней (фокусируемые превью с
// OpenThreadButton) — единственный клавиатурный/тач-путь к комментариям фрагментов.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { InlineAnchorLayer, type AnchorDraft, type AnchoredNote } from "@/components/anchor-engine";
import { useReducedMotion } from "@/components/appearance";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

export interface DocumentCommentNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export interface DocumentCommentLayerProps {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: DocumentCommentNote[];
  canCreate: boolean;
}

const KEY = "comment-highlights";

export function DocumentCommentLayer({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: DocumentCommentLayerProps) {
  const t = useT("comments");
  const reduced = useReducedMotion();
  const astRootRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [showAll, setShowAll] = useState(false); // default OFF (не конкурирует с аннотациями)
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useEffect(() => {
    astRootRef.current = document.querySelector<HTMLElement>("[data-ast-root]");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount read of localStorage pref; SSR/no-JS default off
    if (window.localStorage.getItem(KEY) === "on") setShowAll(true);
    setReady(true);
  }, []);

  const toggle = () => {
    setShowAll((s) => {
      const next = !s;
      window.localStorage.setItem(KEY, next ? "on" : "off");
      return next;
    });
  };

  // Доменные ноты → движковые: только валидный text-range (coordsToEngineAnchor != null).
  const engineNotes: AnchoredNote[] = notes.flatMap((n) => {
    const engine = coordsToEngineAnchor(n.anchor);
    return engine ? [{ id: n.id, anchor: engine }] : [];
  });
  const previewById = new Map(notes.map((n) => [n.id, n.preview]));

  const scrollToThread = useCallback(
    (id: string) => {
      document
        .getElementById(`comment-${id}`)
        ?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      <Inline gap="tight" align="start">
        <Button type="button" compact tone="quiet" onClick={toggle} aria-pressed={showAll}>
          {showAll ? t("marginHighlightHide") : t("marginHighlightShow")}
        </Button>
      </Inline>

      {ready && (
        <InlineAnchorLayer
          astRootRef={astRootRef}
          notes={engineNotes}
          renderCard={(id) => previewById.get(id) ?? null}
          showAllHighlights={showAll}
          canCreate={canCreate}
          onCreateRequest={(d: AnchorDraft) => {
            setComposer({ open: true, anchor: buildCommentTextAnchor(d.anchor, documentId) });
          }}
          affordanceLabel={t("marginCommentAdd")}
          onActivateNarrow={scrollToThread}
        />
      )}

      {/* Доступный список (клавиатура/тач): при showAll показываем превью корней
          потоком — фокусируемые, с OpenThreadButton. Закрывает a11y/тач-дыру,
          т.к. hover-reveal и подсветка недостижимы без мыши. */}
      {showAll && notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id}>{n.preview}</li>
          ))}
        </ul>
      )}

      <CommentComposerDialog
        lectureId={lectureId}
        rootTypes={rootTypes}
        open={composer.open}
        onOpenChange={(open) => {
          setComposer((c) => ({ ...c, open }));
        }}
        anchor={composer.anchor}
      />
    </div>
  );
}
```

- [ ] **Step 4: Прогнать — проходит**

Run: `pnpm vitest run src/features/comments/ui/document-comment-layer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/comments/ui/document-comment-layer.tsx src/features/comments/ui/document-comment-layer.test.tsx
git commit --only src/features/comments/ui/document-comment-layer.tsx src/features/comments/ui/document-comment-layer.test.tsx -m "feat(comments): DocumentCommentLayer на InlineAnchorLayer (lazy+hover, тогл)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Server-сборщик `DocumentComments`

Фетчит комментарии лекции, отбирает заякоренные на документ, строит превью-карточки, отдаёт client-коннектору под `SchemaContextProvider` (composer монтирует AstEditor).

**Files:**
- Create: `src/features/comments/ui/document-comments.tsx`
- Modify: `src/features/comments/index.ts` (export)

**Interfaces:**
- Consumes: `getLectureComments`/`getCommentSchema` (`../api`), `selectAnchoredRoots` (`../anchored`), `canCreateComment` (`../permissions`), `CommentPreviewCard` (Task 7), `DocumentCommentLayer` (Task 9), `getAstSchema`/`SchemaContextProvider`, `getMe`.
- Produces: `DocumentComments({ lectureId, documentId })`.

- [ ] **Step 1: Реализовать `document-comments.tsx`**

```tsx
// src/features/comments/ui/document-comments.tsx
// Server-сборщик левого поля: заякоренные на текущий документ комментарии →
// превью-карточки → client-коннектор (InlineAnchorLayer). Под SchemaContextProvider,
// т.к. композер монтирует AstEditor. Заякоренные комменты ВИДНЫ и в нижнем треде —
// это поле лишь подсветка+быстрый доступ (progressive enhancement).
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { getCommentSchema, getLectureComments } from "../api";
import { selectAnchoredRoots } from "../anchored";
import { canCreateComment } from "../permissions";

import { CommentPreviewCard } from "./comment-preview-card";
import { DocumentCommentLayer, type DocumentCommentNote } from "./document-comment-layer";

export async function DocumentComments({
  lectureId,
  documentId,
}: {
  lectureId: string;
  documentId: string;
}) {
  const [me, schema, list, astSchema] = await Promise.all([
    getMe(),
    getCommentSchema(),
    getLectureComments(lectureId),
    getAstSchema(),
  ]);

  if (!schema) return null;

  const anchored = selectAnchoredRoots(list.subtrees, documentId);
  if (anchored.length === 0 && !canCreateComment(me)) return null;

  const notes: DocumentCommentNote[] = anchored.map((a) => ({
    id: a.id,
    anchor: a.anchor,
    preview: <CommentPreviewCard comment={a.root} replyCount={a.replyCount} />,
  }));

  return (
    <SchemaContextProvider initial={astSchema}>
      <DocumentCommentLayer
        lectureId={lectureId}
        documentId={documentId}
        rootTypes={schema.allowed_roots ?? []}
        notes={notes}
        canCreate={canCreateComment(me)}
      />
    </SchemaContextProvider>
  );
}
```

- [ ] **Step 2: Экспорт из `index.ts`**

Добавить к экспортам фичи:

```ts
export { DocumentComments } from "./ui/document-comments";
```

- [ ] **Step 3: Проверить сборку/линт/тесты**

Run: `pnpm lint && pnpm vitest run src/features/comments && pnpm build`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/features/comments/ui/document-comments.tsx src/features/comments/index.ts
git commit --only src/features/comments/ui/document-comments.tsx src/features/comments/index.ts -m "feat(comments): DocumentComments — server-сборщик левого поля комментов

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Разводка в странице лекции (левое поле)

Левый `MarginNote` с `DocumentComments` (зеркало правого с аннотациями). CSS-канал `::highlight(comment)` уже добавлен в `globals.css` в PR1 (foundation-зона — shell-файл правится в foundation-PR, не в фиче).

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`

- [ ] **Step 1: Импорт + левый `MarginNote` в `page.tsx`**

В импортах фичи комментариев (строка 8) добавить `DocumentComments`:

```tsx
import { CommentSection, DocumentComments } from "@/features/comments";
```

После блока правого `MarginNote` аннотаций (строки 140-147), перед закрывающим `</>`, добавить левый:

```tsx
      {/* Заякоренные комментарии активного документа — ЛЕВОЕ поле грида. */}
      {activeDoc && activeId && (
        <MarginNote side="start" grow className="p-4 xl:pe-0">
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <DocumentComments lectureId={id} documentId={activeId} />
          </Suspense>
        </MarginNote>
      )}
```

- [ ] **Step 2: Проверить сборку/линт**

Run: `pnpm lint && pnpm build`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/app/lectures/[id]/page.tsx
git commit --only src/app/lectures/[id]/page.tsx -m "feat(comments): левое поле заякоренных комментов на странице лекции

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Финальный гейт + браузер-QA

**Files:** нет изменений кода.

- [ ] **Step 1: Полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 2: Ручная браузер-QA (`pnpm dev`, `/lectures/<id>` с активным документом, ≥1280px и <1280px)**

Чек-лист:
- выделить текст в документе → аффорданс «Комментировать» → композер с цитатой → создать → комментарий появился в нижнем треде;
- навести курсор на прокомментированный фрагмент → подсветка (пунктир) проявляется;
- тогл «Показать комментарии в тексте» → все заякоренные фрагменты подсвечены + появляется доступный список превью под тоглом; перезагрузка хранит состояние (default OFF);
- клик по подсвеченному фрагменту (≥1280px) → превью-карточка в ЛЕВОМ поле у фрагмента; «Открыть обсуждение» → скролл к узлу в нижнем треде;
- узкий экран (<1280px) → клик по фрагменту сразу скроллит к треду;
- **a11y/клавиатура:** включить тогл → Tab по списку превью → Enter на «Открыть обсуждение» скроллит к треду (без мыши); проверить, что reduced-motion (appearance motion=reduced ИЛИ OS prefers-reduced-motion) → скролл без анимации;
- **тач:** на телефоне (узкий, hover нет) тогл показывает список превью — фрагменты обнаружимы без hover;
- аннотации справа продолжают работать (правый канал не задет); наложение аннотация+комментарий на одном тексте: оба различимы визуально (комментарий — пунктир); ⚠️ известный edge: при ТОЧНОМ наложении клик сработает в ОБОИХ слоях (откроется превью слева И активируется аннотация справа со скроллом) — приемлемо для редкого наложения, зафиксировать поведение;
- RTL (ar): поле комментов слева/справа зеркалится логическими свойствами; подсветка корректна.

- [ ] **Step 3: Статус бэк-асков**

1. **cross-lecture validation — ✅ ЗАКРЫТ на бэке (2026-06-26).** Проверка добавлена по типам цели (document/media — прикреплена к лекции; comment — та же лекция; glossary — глобальный), код `ANCHOR_TARGET_WRONG_LECTURE` (422). Наш путь не затронут. **FE-realign (follow-up, координированно, НЕ в этой фиче):** регенерировать `schema.ts` (сейчас только `ANCHOR_INVALID`) → подтянуть `ANCHOR_TARGET_WRONG_LECTURE`/`ANCHOR_ENTITY_UNKNOWN`/`ANCHOR_BLOCK_NOT_FOUND`/`ANCHOR_TARGET_NOT_FOUND` → добавить в `ERRORS`-map `createComment` (`actions.ts`) + сообщения в `errors`-каталог (4 локали). Реалистичный кейс для пользователя — text-drift выделения → `ANCHOR_BLOCK_NOT_FOUND` («выделенный фрагмент больше недоступен, выделите заново»).
2. **инвариант anchor-only-on-root — открыт.** Гарантирует ли бэк, что anchor только на корне, или FE должен обрабатывать `descendants[].anchor`? v1 `selectAnchoredRoots` берёт только корни.

---

## Self-Review (выполнено автором плана)

- **Покрытие спеки:** модель (anchor-опция: Task 1/3), read-превью+к-треду (Task 7/8/9), подсветка hover/тогл (Task 9 + InlineAnchorLayer из PR1), scope=document (Task 1/2), узкие экраны=скролл (Task 9 onActivateNarrow), сосуществование (отдельный CSS-канал, Task 11), разводка слева (Task 11), бэк-аск (Task 12). Все разделы спеки покрыты.
- **Зависимость от PR1:** `InlineAnchorLayer`, `useHoverReveal`, `@/utils/text-anchor`, `@/utils/anchor-json` — все определены в `2026-06-26-anchor-engine-foundation.md`. Этот план стартует после мержа PR1.
- **Плейсхолдеров нет:** код реальный; команды с ожидаемым результатом; единственная условная развилка (async-server `CommentAnchorContext` в client-диалоге, Task 6) имеет явный fallback.
- **Консистентность типов:** `Anchor` (`comment.Anchor`), `AnchoredRoot`, `DocumentCommentNote`, `buildCommentTextAnchor`, `selectAnchoredRoots`, `DocumentCommentLayerProps` — имена совпадают между блоком Interfaces и тасками. `coordsToEngineAnchor`/`engineAnchorToCoords`/`anchorJsonField` — из PR1, имена совпадают.
- **i18n-паритет:** Task 4 добавляет ключи во все 4 локали одним коммитом до их использования в Task 5/6/7/9.

## Правки по адверсариальному ревью (4 субагента)

- **[CRITICAL] i18n namespace:** ключи якоря `anchorNotObject`/`anchorInvalidJson` резолвятся через `NamespaceT<"validation">` → идут в `validation.ts` (под `comments:`), а не в `comments.ts`; UI-ключи маргиналии — в `comments.ts`. Task 4 расщеплён на два namespace (иначе missing-key в рантайме).
- **[CRITICAL] reduced-motion:** `OpenThreadButton` (Task 7) и `scrollToThread` (Task 9) уважают ось appearance motion через `useReducedMotion()` (`behavior: reduced ? "auto" : "smooth"`) — иначе регрессия.
- **[Task 6] async-server в client:** `CommentComposerDialog` НЕ импортирует async `CommentAnchorContext` (не собралось бы) → инлайн-бликвот `anchor.exact`.
- **[a11y/тач] доступный список:** при `showAll` `DocumentCommentLayer` рендерит список превью (фокусируемый, с `OpenThreadButton`) — единственный клавиатурный/тач-путь, т.к. hover/подсветка недостижимы без мыши (Task 9). Тогл получил `aria-pressed`.
- **[edge] удалённые корни** отсеиваются в `selectAnchoredRoots` (Task 2); non-root якоря — осознанный YAGNI + бэк-аск (Task 12).
- **globals.css перенесён в PR1** (foundation) — Task 11 правит только страницу.

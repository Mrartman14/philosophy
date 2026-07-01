# Дизайн: hoist page-level create-anchor действий из per-scope компонентов

Дата: 2026-07-01
Слайсы: `src/features/annotations`, `src/features/comments`, `src/components/anchor-engine`, страницы `lectures/[id]` и `documents/[id]`.
Статус: одобрен пользователем (брейншторм). Подход: **структурный hoist**.

## Проблема

Действие «создать якорь» — page-level синглтон (по одному id на страницу), но регистрируется оно из **множимых** per-scope компонентов:

- `id="annotation"` регистрируется каждым `AnnotationScope`: 1× на документ (`DocumentAnnotations`) + **1× на каждый `CommentNode`** ([comment-node.tsx](../../../src/features/comments/ui/comment-node.tsx) → [annotation-scope.tsx:186](../../../src/features/annotations/ui/annotation-scope.tsx)). Лекция с 50 комментариями = 51 регистрация одного id.
- `id="comment-anchor"` регистрируется каждым `CommentAnchorScope` (1× на документ, [comment-anchor-scope.tsx:176](../../../src/features/comments/ui/comment-anchor-scope.tsx)).

Реестр в провайдере дедуплицирует по id: `register` делает `filter(id) + push`, `unregister` — `filter(id)` ([anchor-actions.tsx:85-96](../../../src/components/anchor-engine/anchor-actions.tsx)). В массиве всегда **ровно одна** запись на id.

### Два следствия

1. **Латентный баг корректности.** У каждого регистранта — свой cleanup `unregister(id)` ([anchor-actions.tsx:153-159](../../../src/components/anchor-engine/anchor-actions.tsx)). Раз запись в реестре одна на всех, **первый же** из N скоупов, который размонтируется (свернуть/удалить/пагинировать комментарий), вызывает `unregister("annotation")` и убирает действие для **всех** оставшихся смонтированных скоупов. Их эффекты не перезапускаются (депы стабильны) → никто не перерегистрирует. Результат: на выделении текста кнопка «Аннотировать» пропадает по всей странице до полного ремоунта.
2. **Churn.** N register/unregister при монтировании → лишние setState в провайдере.

Корректность самого создания сегодня спасена лишь тем, что `onCreate` берёт `draft.scope` (скоуп выделения), а не пропсы компонента — «выживший action может принадлежать чужому скоупу», но создаёт правильную аннотацию. Исчезновение действия при unmount это НЕ закрывает.

## Корень

Page-level синглтон регистрируется из per-scope компонента — **неверная высота**. Действие уже целиком опирается на `draft.scope` (выделение), а не на пропсы → ему нечего делать per-scope.

## Подход: структурный hoist

Вынести selection-driven действие + его anchored-композер в **один** page-level маунт на страницу. Per-scope компоненты оставляют только то, что законно per-scope: rail-регистрацию, fallback-рендер, document-only тулбар.

Отклонённая альтернатива — ref-counting в реестре (провайдер считает регистрантов на id, `unregister` удаляет запись только при count→0). Чинит баг + хрупкость минимальной правкой, но конструкция «N синглтонов на один id» и churn сохраняются — не убирает то, что смущает по сути.

## Компоненты

### Новые — слайс `annotations`

- **`AnnotationCreateAffordance`** (server-ассемблер, зеркалит стиль `DocumentAnnotations`):
  - `getMe()` → `canCreateAnnotation(me)`; при `!canCreate` → `null`.
  - `getAstSchema()` (нужна композеру для тела аннотации).
  - Рендерит client-композер под `SchemaContextProvider initial={astSchema}`.
- **`AnnotationSelectionComposer`** (client, self-contained — сворачивает нынешний `AnnotationCreateAction` + композер-часть `AnnotationScope`):
  - `useStableAnchorAction({ id: "annotation", label, enabled, appliesTo: APPLIES_TO_ANY, onCreate })`.
  - **Владеет** composer-state (`open`, `parentEntityType`, `parentId`, `anchor`).
  - `onCreate(draft)` повторяет нынешний `AnnotationCreateAction`: guard `isParentEntityType(draft.scope.entityType)`; открыть композер с `parentEntityType/parentId` из `draft.scope` + `anchor: fromEngineAnchor(draft.anchor)`.
  - Рендерит `AnnotationComposerDialog`.

### Новые — слайс `comments`

- **`CommentAnchorCreateAffordance`** (server-ассемблер):
  - `getMe()` → `canCreateComment(me)`; при `!canCreate` → `null`.
  - `getCommentSchema()` → `allowed_roots` (rootTypes), `getAstSchema()`.
  - Рендерит client-композер под `SchemaContextProvider`.
  - Пропы: `lectureId`.
- **`CommentAnchorSelectionComposer`** (client, self-contained — сворачивает `CommentAnchorCreateAction` + композер-часть `CommentAnchorScope`):
  - `useStableAnchorAction({ id: "comment-anchor", label, enabled, appliesTo: APPLIES_TO_DOCUMENT, onCreate })`.
  - Владеет composer-state; `onCreate(draft)` → `{ targetDocumentId: draft.scope.entityId, anchor: buildCommentTextAnchor(draft.anchor, draft.scope.entityId) }`.
  - Рендерит `CommentComposerDialog` (`lectureId`, `rootTypes`, `anchor`).

### Изменяемые

- **[annotation-scope.tsx](../../../src/features/annotations/ui/annotation-scope.tsx)**: убрать импорт/рендер `AnnotationCreateAction` и selection-ветку `onOpenComposer`. **Оставить**: rail-регистрацию (`useRegisterRailScope`), fallback-рендер (`ssrOnly` + inline), document-only тулбар (тумблер подсветки + «add unanchored»). Композер (`AnnotationComposerDialog`) остаётся **только** для unanchored-пути и рендерится **под `showToolbar`** — так per-comment скоупы (`showToolbar=false`) теряют и N простаивающих закрытых диалогов. Composer-state для unanchored всегда таргетит пропсы своего скоупа (`parentEntityType`/`parentId`), `anchor` — undefined.
- **[comment-anchor-scope.tsx](../../../src/features/comments/ui/comment-anchor-scope.tsx)**: убрать `CommentAnchorCreateAction` + composer-state + `CommentComposerDialog` → компонент сводится к rail-регистрации + fallback-рендеру.
- **[annotations/index.ts](../../../src/features/annotations/index.ts)**, **[comments/index.ts](../../../src/features/comments/index.ts)**: экспорт новых `*CreateAffordance` (server).
- **[lectures/[id]/page.tsx](../../../src/app/lectures/[id]/page.tsx)**: под `AnchorScopeProvider`, рядом с `SelectionAffordanceHost`, смонтировать `<AnnotationCreateAffordance />` + `<CommentAnchorCreateAffordance lectureId={id} />` (обёрнуть в `Suspense` с `null`-фолбэком — до выделения аффорданс невидим).
- **[documents/[id]/page.tsx](../../../src/app/documents/[id]/page.tsx)**: смонтировать `<AnnotationCreateAffordance />` (только аннотации — комментов на standalone-документе нет).

### Удаляемые/сворачиваемые

- `annotation-create-action.tsx` → свёрнут в `AnnotationSelectionComposer`.
- Экспорт `CommentAnchorCreateAction` → свёрнут в `CommentAnchorSelectionComposer`.

## Поток данных (UX без изменений)

1. Пользователь выделяет текст в любом `[data-anchor-scope]` (тело документа или тело коммента; атрибут ставит серверный рендер / `comment-node-view`, независимо от `AnnotationScope`).
2. `SelectionAffordanceHost` читает `draft.scope` и рисует применимые кнопки: annotation — всегда; comment-anchor — только на document-скоупе.
3. Клик → **единственный** page-level композер открывается с parent/anchor, выведенными из скоупа выделения. Идентично сегодняшнему.

Схема: `getAstSchema` — `unstable_cache` ([schema-server.ts](../../../src/components/ast-editor/schema-server.ts)) → лишняя page-level загрузка дедупится с существующими (`DocumentAnnotations`/`CommentSection`/`DocumentComments`), нового HTTP нет.

Права: `canCreateAnnotation` = `can(me, "annotation.create")`, `canCreateComment` = `can(me, "comment.create")` — **плоские капабилити**, одинаковые для всех скоупов страницы. Page-level `enabled` равен тому значению, что каждый скоуп передавал сегодня — семантика не меняется; заодно уходит нынешний недетерминизм «чей `canCreate` выжил».

## Почему безопасно / корректно

- Действие регистрируется **ровно один раз** на страницу, независимо от числа скоупов. Mount/unmount скоупа больше не может добавить/убрать его → «первый unmount убивает» структурно исчезает.
- Rail-регистрация остаётся per-scope, но ключуется по скоупу (`annotation:<type>:<id>`, `comment:document:<id>`) — коллизии id нет, корректна по построению.
- `comments/[id]` (пермалинк) не имеет `AnchorScopeProvider` → тамошние регистрации уже no-op; страницу не трогаем.

## Тесты (TDD)

- **Новый регресс** (движок/интеграция, главный страж): при смонтированном page-level композере + нескольких rail-скоупах —
  - (а) в реестре ровно одно действие `"annotation"`;
  - (б) unmount одного rail-скоупа **не** убирает действие / `SelectionAffordanceHost` продолжает показывать кнопку и `onCreate` срабатывает.
- Переселить [annotation-create-action.test.tsx](../../../src/features/annotations/ui/annotation-create-action.test.tsx) и [comment-anchor-create.test.tsx](../../../src/features/comments/ui/comment-anchor-create.test.tsx) на новые self-contained композеры.
- [annotation-scope-cross-scope.test.tsx](../../../src/features/annotations/ui/annotation-scope-cross-scope.test.tsx): сценарий «выживший принадлежит чужому скоупу» теперь тривиально корректен (действие единственное, page-level) — обновить ассерты под новую структуру.
- [anchor-actions.test.tsx](../../../src/components/anchor-engine/anchor-actions.test.tsx): оставить — идемпотентность реестра по id сохраняется (теперь единственный регистрант).
- Гейт зелёный: `pnpm lint && pnpm test && pnpm build`.

## Вне объёма (YAGNI)

- Ref-counting/дедуп во внутренностях реестра — структурный hoist делает его ненужным.
- Rail-регистрация, выноски-связи, семантика подсветки — не трогаем.
- «add unanchored» — оставляем как есть (осознанная фича: аннотация уровня документа без якоря; уже корректный синглтон в document-тулбаре, коллизии нет).
- Guardrail-2 seam (`comment-node` → `annotations` barrel) — отдельный foundation-PR, здесь не трогаем.
- `comments/[id]` пермалинк — без изменений.

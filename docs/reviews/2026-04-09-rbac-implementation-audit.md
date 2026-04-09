# RBAC унификация — аудит реализации

**Дата:** 2026-04-09
**Скоуп:** пост-реализационный аудит 22-task RBAC-унификации
**План:** [docs/plans/2026-04-09-rbac-unification-plan.md](../plans/2026-04-09-rbac-unification-plan.md)
**Коммиты:** `3b15c8dc`..`d7291db1` (22 коммита в main)

## Методология

Три параллельных субагента покрыли:
- **A.** Серверный слой (actions, layouts, proxy, server components, permissions.ts)
- **B.** Клиентский UI (forbidden handling, LoginCta/ActionTooltip, useActionState/useTransition консистентность)
- **C.** Cross-cutting (auth flow, open-redirect, регрессии, dead code, race conditions)

Находки дедуплицированы и верифицированы чтением кода. Ниже — то, что осталось после отсева ложных срабатываний (см. секцию «False alarms» в конце).

## Сводка

| Severity | Count |
|----------|-------|
| Critical | 3     |
| Major    | 7     |
| Minor    | 14    |
| Nit      | 5     |

---

## Critical

### C1. Open-redirect через обратный слэш в `safeNext`
- **File:** [src/features/auth/actions.ts:11-15](../../src/features/auth/actions.ts#L11-L15)
- **Что:** `safeNext("/\\evil.com")` проходит проверку: `startsWith("/")` → true, `startsWith("//")` → false (второй символ — `\`, не `/`). Возвращается как есть. Chrome/Firefox нормализуют `\` → `/` в path Location-header'а, получаем `//evil.com` → protocol-relative → `https://evil.com`. То же для `/\/evil.com`, `/%5cevil.com` (если где-то decode'ится до нашей проверки).
- **Почему:** Security. `?next=` контролируется атакующим. Classic post-login phishing redirect. План Task 20 обещал защиту от open-redirect — реализация неполная.
- **Fix:**
  ```ts
  function safeNext(next: string | null): string {
    if (!next) return "/";
    // Требуем одиночный "/" + не-слэш/не-бэкслэш. Отбрасывает "", "//x", "/\\x", "http://...", "javascript:".
    if (!/^\/[^/\\]/.test(next)) return "/";
    return next;
  }
  ```

### C2. Необработанный `code: "forbidden"` в публичных UI — сырое `"Forbidden: status"` у пользователя
- **Files:**
  - [src/features/comments/comment-item-actions.tsx:31-33](../../src/features/comments/comment-item-actions.tsx#L31-L33) — удаление комментария
  - [src/features/annotations/annotation-highlight.tsx:357-359](../../src/features/annotations/annotation-highlight.tsx#L357-L359) — `AnnotationItemActions`, удаление аннотации
  - [src/features/comments/comment-form.tsx:72-73](../../src/features/comments/comment-form.tsx#L72-L73), [:142-146](../../src/features/comments/comment-form.tsx#L142-L146)
  - [src/features/annotations/annotation-form.tsx:78-80](../../src/features/annotations/annotation-form.tsx#L78-L80)
- **Что:** `ForbiddenError.message` по умолчанию — техническая строка `"Forbidden: guest"` / `"Forbidden: status"` / `"Forbidden: role"` (см. `src/utils/permissions.ts` — конструктор `ForbiddenError`). Эти четыре места показывают `result.error` / `state.error` сырым. Suspended user / race condition → видит техническую строку вместо человеческого сообщения.
- **Почему:** Task 19 плана требовал branding `code === "forbidden"` **во всех** местах, где показывается `result.error`. Покрыты только 9 admin-файлов. Публичные (comments + annotations) пропущены.
- **Fix:** Каждому месту добавить guard:
  ```ts
  setError(
    result.code === "forbidden"
      ? "У вас нет прав на это действие."
      : result.error
  );
  ```

### C3. `user-status-inline` — состояние select не синхронизируется с props
- **File:** [src/features/admin/users/user-status-inline.tsx:16](../../src/features/admin/users/user-status-inline.tsx#L16)
- **Что:** `useState<UserStatus>(currentStatus)` инициализируется **один раз** при mount. После успешного `updateUserStatus` action вызывает `revalidatePath("/admin/users")` → таблица перерисовывается → родитель передаёт новый `currentStatus` prop, но локальный `status` state держит старое значение. Класс. баг «initial prop ignored after mount».
- **Почему:** Сценарий проявления — конкурентные изменения (два админа одновременно, либо revalidation из другого action'а). UI покажет устаревшее значение, хотя бэк уже обновлён. Data-integrity risk.
- **Fix:** Один из двух:
  1. Родитель передаёт `key={currentStatus}` — перемонтирует при изменении.
  2. Синхронизация через effect:
     ```ts
     useEffect(() => setStatus(currentStatus), [currentStatus]);
     ```

---

## Major

### M1. Admin sub-pages не делают layer-3 capability gate
- **Files:**
  - [src/app/admin/users/page.tsx](../../src/app/admin/users/page.tsx)
  - [src/app/admin/push/page.tsx](../../src/app/admin/push/page.tsx)
  - [src/app/admin/comments/page.tsx](../../src/app/admin/comments/page.tsx)
  - [src/app/admin/annotations/page.tsx](../../src/app/admin/annotations/page.tsx)
  - [src/app/admin/lectures/page.tsx](../../src/app/admin/lectures/page.tsx)
  - [src/app/admin/lectures/[id]/page.tsx](../../src/app/admin/lectures/[id]/page.tsx)
- **Что:** `admin/layout.tsx` гейтит только `canAccessAdmin` (широкий `admin.access`). Sidebar динамически показывает пункты по узким capability (`user.list`, `push.send`, `comment.moderate`, ...). Но если модератор с `admin.access` + `comment.moderate` вобьёт `/admin/push` руками, layout его пропустит, `<PushSender>` отрендерится. Action-layer отсечёт при сабмите (defense-in-depth есть), но UI показывает функционал, на который прав нет.
- **Почему:** Плановая «четырёхслойная защита» (proxy → layout → **server component** → action) пропускает слой 3. UX-дефект, не security-issue.
- **Fix:** В каждой sub-page добавить:
  ```ts
  const me = await getMe();
  if (!canSendPush(me)) forbidden();  // (подставить нужный can)
  ```
  Либо завести хелпер `guardAdminPage(capability)`.

### M2. `LectureTable` не гейтит кнопки Edit/Delete по capability
- **File:** [src/features/admin/lectures/lecture-table.tsx:56-64](../../src/features/admin/lectures/lecture-table.tsx#L56-L64)
- **Что:** «Редактировать» и `<LectureDeleteButton>` рендерятся безусловно для всех с `admin.access`. Модератор без `lecture.delete` увидит рабочую-на-вид кнопку → клик → `ForbiddenError`.
- **Фикс:** В `admin/lectures/page.tsx` вычислить `canUpdate = canUpdateLecture(me)`, `canDelete = canDeleteLecture(me)`, пробросить в `LectureTable` и рендерить кнопки условно.

### M3. `UserTable` не отличает `user.list` от `user.moderate`
- **File:** [src/features/admin/users/user-table.tsx:44](../../src/features/admin/users/user-table.tsx#L44)
- **Что:** `<UserStatusInline>` (select смены статуса) рендерится для всех. Капабилити `user.list` и `user.moderate` — разные, и sidebar показывает `/admin/users` при `canListUsers`. Юзер с `user.list` без `user.moderate` получит рабочий-на-вид select, клик → 403.
- **Fix:** `const canModerate = canModerateUsers(me)` в page.tsx → проброс в `UserTable` → при `!canModerate` рендерить статус как текст, не select.

### M4. Цепочка `?next=` обрывается на `login → register`
- **Files:**
  - [src/features/auth/login-form.tsx:63-68](../../src/features/auth/login-form.tsx#L63-L68) — ссылка «Зарегистрироваться»
  - [src/features/auth/register-form.tsx](../../src/features/auth/register-form.tsx)
  - [src/app/register/page.tsx](../../src/app/register/page.tsx)
  - [src/features/auth/actions.ts](../../src/features/auth/actions.ts) — `register` action
- **Что:** Proxy редиректит гостя `/admin/...` → `/login?next=/admin/...`. Пользователь кликает «Зарегистрироваться» → `/register` без `next`. После регистрации `register` action редиректит на `/login` без `next`. На следующем логине `next` уже потерян, пользователь попадает на `/`.
- **Почему:** Регрессия фичи `?next=` из Task 20. Плановая фраза «register не требует next» буквальна (там нет защищённых страниц), но не учитывает кросс-фловы.
- **Fix:** Прокинуть `next` в ссылку `Link href={"/register" + (next ? `?next=${encodeURIComponent(next)}` : "")}`, принять `searchParams.next` в `register/page.tsx`, передать в `register-form` как hidden input, и в `register` action после `POST /api/auth/register` редиректить на `/login?next=...`.

### M5. `uploadFile` делает валидацию формы до `requireCapability`
- **File:** [src/features/admin/actions.ts:214-232](../../src/features/admin/actions.ts#L214-L232)
- **Что:** `if (!type) throw new Error("Укажите тип файла")` / `if (!(file instanceof File) ...)` стоят **перед** `requireCapability(me, canUploadLectureFiles)`. Гость/suspended при попытке обойти увидит «Укажите тип файла» вместо forbidden.
- **Почему:** Неконсистентно с остальными `createFormAction`-actions, где guard идёт сразу после извлечения полей. Не security (бэк отсечёт), но нарушает defense-in-depth семантику.
- **Fix:** Переставить `requireCapability` вверх, до проверок пустоты.

### M6. `ReactionButton` — нет feedback при ошибке
- **File:** [src/features/comments/reaction-button.tsx:38-49](../../src/features/comments/reaction-button.tsx#L38-L49)
- **Что:** `await addReaction(...)` — результат игнорируется. При `{success:false}` React 19 `useOptimistic` **корректно откатит** optimistic state (после завершения transition без revalidate), так что data-integrity OK (агенты ошиблись с оценкой «permanent drift»). НО: пользователь видит мгновенный «отскок» сердечка без объяснения. Suspended user не поймёт, почему лайк не сработал.
- **Почему:** Silent UX failure в новых RBAC-сценариях, которых до рефактора не было.
- **Fix:** Проверить `result.success`, при forbidden — показать tooltip/toast/aria-live «Не удалось поставить лайк — проверьте статус аккаунта». Необязательно inline (кнопка маленькая), лучше глобальный toast-механизм.

### M7. Comments/Annotations для suspended/banned — молча исчезающая форма
- **Files:**
  - [src/features/comments/comment-list.tsx:36-43](../../src/features/comments/comment-list.tsx#L36-L43) — `canCreateComment(me) ? <CommentForm /> : !me ? <LoginCta /> : null`
- **Что:** Для suspended/banned возвращается `null`. Для гостей — `<LoginCta>`. Аналогичный блок в `annotation-highlight.tsx` показывает `<ActionTooltip>` с disabled-кнопкой. Несогласованность.
- **Почему:** Экспортируемая `whyCannotCreateComment` объявлена, документирована «для выбора UX», но нигде не используется (dead export). Suspended user не поймёт, почему форма исчезла (глобальный `<StatusBanner>` объясняет причину, но локальная фича — нет).
- **Fix:** Либо `<p>Нельзя оставить комментарий — аккаунт ограничен.</p>`, либо (лучше) ActionTooltip + disabled-форма — консистентно с аннотациями. В любом случае использовать `whyCannotCreateComment`.

---

## Minor

### m1. `comments`/`annotations` actions используют ручной inline-guard вместо `requireCapability`
- **Files:** [src/features/comments/actions.ts:77-78](../../src/features/comments/actions.ts#L77-L78), [:100-101](../../src/features/comments/actions.ts#L100-L101); [src/features/annotations/actions.ts:72-73](../../src/features/annotations/actions.ts#L72-L73), [:99-100](../../src/features/annotations/actions.ts#L99-L100)
- **Что:** `editComment`/`deleteComment`/`editAnnotation`/`deleteAnnotation` используют `if (!me) throw ForbiddenError("guest"); if (me.status !== "active") throw ForbiddenError("status");` вместо `requireCapability(me, isMutationAllowed)`. Дублирование, неконсистентно с `admin/actions.ts`.
- **Fix:** `requireCapability(me, isMutationAllowed)` (хелпер уже правильно мапит `null → "guest"`, not-active `→ "status"`).

### m2. `user-status-inline` — error показывается как «!» без текста и без `role="alert"`
- **File:** [src/features/admin/users/user-status-inline.tsx:44-48](../../src/features/admin/users/user-status-inline.tsx#L44-L48)
- **Что:** `<span className="text-xs text-red-500" title={error}>!</span>`. Скринридеры проигнорируют. `title=` не работает на touch. Несогласованно с остальными admin-компонентами (везде — полный текст + `role="alert"`).
- **Fix:** `<span role="alert" className="text-xs text-red-500">{error}</span>` как везде.

### m3. `annotation-form.tsx` — нет `role="alert"` и нет forbidden-branding
- **File:** [src/features/annotations/annotation-form.tsx:78-80](../../src/features/annotations/annotation-form.tsx#L78-L80)
- **Что:** Единственная форма без `role="alert"` на inline-ошибке. Forbidden не различается. (Частично пересекается с C2.)
- **Fix:** Добавить `role="alert"` и forbidden-branding.

### m4. `file-manager.tsx` — аномальный `initialState = { success: true, data: undefined }`
- **File:** [src/features/admin/lectures/file-manager.tsx:13](../../src/features/admin/lectures/file-manager.tsx#L13)
- **Что:** Единственный файл, где `useActionState` стартует с `success: true`. Рендер корректен (`state.success === false && ...` просто false), но типологически неправильно: заявлять «success» без реальной операции. Несогласованно с комментариями в других файлах, которые ссылаются на «соглашение проекта P1-#19: initialState — null».
- **Fix:** Привести к `null` initial state как все остальные формы с `useActionState`.

### m5. `annotation-highlight.tsx` — `editInitialState` на `ActionResult` вместо `null`
- **File:** [src/features/annotations/annotation-highlight.tsx:307-310](../../src/features/annotations/annotation-highlight.tsx#L307-L310)
- **Что:** `editInitialState: ActionResult<Annotation> = { success: false, error: "" }`. Тот же анти-паттерн, против которого предупреждает P1-#19. Guard `!state.success && state.error` рендер защищает, но смешение стилей.
- **Fix:** `null | ActionResult<Annotation>` initial, как в большинстве других форм.

### m6. `transcript-editor.tsx` — двойной refresh (`router.refresh()` + `revalidatePath` в action)
- **File:** [src/features/admin/lectures/transcript-editor.tsx:77,99,117](../../src/features/admin/lectures/transcript-editor.tsx#L77)
- **Что:** Action уже делает `revalidatePath`. Клиент дополнительно дёргает `router.refresh()`. Двойная сетевая round-trip.
- **Fix:** Убрать `router.refresh()`. Проверить, что `addSegment`/`updateSegment`/`deleteSegment` в `admin/actions.ts` делают `revalidatePath` (по коду — да).

### m7. Неконсистентные тексты forbidden между файлами
- **Files:** весь Task 19 cluster
- **Что:** Три варианта:
  1. «У вас нет прав на это действие. Обновите страницу.» — `lecture-delete-button`, `user-status-inline`, `comment-moderation`, `annotation-moderation`
  2. «У вас нет прав на <конкретное действие>.» — `lecture-editor`, `lecture-create-form`, `push-sender`, `transcript-editor`, `file-manager`
  3. Нет branding вообще — `comment-form`, `annotation-form`, `comment-item-actions`, `annotation-highlight`, `register-form` (см. C2)
- **Почему:** «Обновите страницу» — неправда для suspended (обновление не поможет). Единый стиль — UX требование.
- **Fix:** Принять один шаблон «У вас нет прав на <действие>.» без «обновите страницу», применить везде.

### m8. `createComment`/`createAnnotation`/`createLecture` — валидация до guard → sus/guest видит «Укажите название» вместо forbidden
- **Files:** [src/features/comments/actions.ts:27-42](../../src/features/comments/actions.ts#L27-L42); [src/features/annotations/actions.ts:29-37](../../src/features/annotations/actions.ts#L29-L37); [src/features/admin/actions.ts:40-51](../../src/features/admin/actions.ts#L40-L51)
- **Что:** Формально план Task 8/11/18 требует «валидация → guard → API», чтобы валидацию не путали с forbidden. Но если гость отправит пустую форму, он получит «Комментарий не может быть пустым» вместо «Войдите». Семантически сбивает.
- **Почему:** Спорное решение плана. Логичнее «guard → валидация», поскольку гостю/suspended неважно, что именно он заполнил.
- **Fix:** Обсудить с product/plan: либо оставить как есть, либо поднять guard перед валидацией в create-actions.

### m9. `whyCannotCreateComment` — мёртвый публичный экспорт
- **File:** [src/features/comments/permissions.ts:42-46](../../src/features/comments/permissions.ts#L42-L46)
- **Что:** Функция документирована «для выбора UX», но импортируется только косвенно через `whyCannotReactToComment` (тривиальная обёртка).
- **Почему:** Indicator, что suspended-UX для комментариев не доведён до конца (см. M7).
- **Fix:** Применить в `comment-list.tsx` при реализации M7, либо сделать private, либо удалить.

### m10. `Comment-item` — дублирующие пропсы `canReact: boolean` + `reactionDeny: DenyReason | null`
- **File:** [src/features/comments/comment-item.tsx:10-13](../../src/features/comments/comment-item.tsx#L10-L13)
- **Что:** `canReact ⟺ reactionDeny === null` — две формы одного состояния, источник рассинхронизации.
- **Fix:** Оставить один проп; `canReact` выводимо как `reactionDeny === null`.

### m11. `AnnotationHighlight` — тот же дубль: `canCreate: boolean` + `createDeny: DenyReason | null`
- **File:** [src/features/annotations/annotation-highlight.tsx:26-30](../../src/features/annotations/annotation-highlight.tsx#L26-L30)
- **Fix:** Оставить один.

### m12. Dead code в `ActionResult.code` union
- **File:** [src/utils/create-action.ts:17](../../src/utils/create-action.ts#L17)
- **Что:** `code?: "forbidden" | "validation" | "network"` — `"validation"` и `"network"` нигде не устанавливаются.
- **Fix:** Сократить union до `"forbidden"`, либо реализовать `ValidationError extends Error` + маппинг в `toResult`. Упрощение предпочтительнее до появления реальной потребности.

### m13. Отсутствует кастомный `forbidden.tsx`
- **File:** `src/app/admin/forbidden.tsx` (нет)
- **Что:** `admin/layout.tsx` вызывает `forbidden()`, но ни в `src/app/`, ни в `src/app/admin/` нет `forbidden.tsx` — Next.js показывает дефолтный англоязычный экран.
- **Fix:** Создать `src/app/admin/forbidden.tsx` с русским сообщением «Нет доступа к админ-панели» и ссылкой на главную.

### m14. `canModerateUsers` как альтернативный гейт sidebar не используется
- **File:** [src/features/admin/permissions.ts](../../src/features/admin/permissions.ts) — `getAdminNavItems`
- **Что:** Пункт «Пользователи» в sidebar гейтится по `canListUsers`. Модератор с `user.moderate`, но без `user.list`, не увидит ссылку.
- **Fix:** `visible: canListUsers(me) || canModerateUsers(me)`. (Если бэк гарантирует `user.list ⊂ user.moderate`, то fix не нужен — но это не документировано.)

---

## Nit

### n1. `AppHeader` показывает `me.role` вместо `me.username`
- **File:** [src/components/app/app-header/app-header.tsx:34](../../src/components/app/app-header/app-header.tsx#L34)
- **Что:** План 2 раза пишет «header показывает username». Реально — `{me.role}`.
- **Fix:** Решить product-wise что показывать (или то, или другое). Не баг.

### n2. `AdminSidebar` импортирует `AdminNavItem` из server-only модуля
- **File:** [src/features/admin/admin-sidebar.tsx:5](../../src/features/admin/admin-sidebar.tsx#L5)
- **Что:** `"use client"` + `import type { AdminNavItem } from "@/features/admin/permissions"`. `permissions.ts` транзитивно зависит от `@/utils/me` (`server-only`). Работает благодаря `import type` (стирается), но любой случайный non-type импорт сломает.
- **Fix:** Вынести `AdminNavItem` interface в отдельный `admin-nav-types.ts` без зависимости на `permissions.ts`.

### n3. Нет секции RBAC в `CLAUDE.md`
- **File:** [CLAUDE.md](../../CLAUDE.md)
- **Что:** Новые агенты не узнают про trinity `getMe + can + requireCapability`. План упоминает желание задокументировать.
- **Fix:** Добавить секцию `## RBAC`: краткая ссылка на `src/utils/permissions.ts`, правило «в action'ах — `getMe` + `requireCapability`», «в UI — `canX()` хелперы из `src/features/*/permissions.ts`».

### n4. `DenyReason` — нет отдельной причины «owner»
- **File:** [src/utils/permissions.ts](../../src/utils/permissions.ts)
- **Что:** `DenyReason = "guest" | "status" | ...`. Различение «не владелец» ручное в хелперах. Minor consistency.
- **Fix:** Не требуется, отмечено как note.

### n5. Re-export `canModerateComments`/`canModerateAnnotations` через two-step в `admin/permissions.ts`
- **File:** [src/features/admin/permissions.ts:3-8](../../src/features/admin/permissions.ts#L3-L8)
- **Что:** Сделан двухстрочный `import { X } from "..."; export { X };` вместо `export { X } from "..."`. Функционально идентично. Отклонение от плана — осознанное (см. commit message `742afe0f` — локальная ссылка нужна для `getAdminNavItems`).
- **Fix:** Ничего, так и должно быть.

---

## False alarms (проверил, не баги)

- **`login-form.tsx` пустой `<p>` при initialState `{success:false, error:""}`** — добавлен guard `&& state.error`, всё OK.
- **`lecture-create-form.tsx`/`lecture-editor.tsx`/`push-sender.tsx` пустой alert на первом рендере** — все используют `null` initial state, `state?.success === false` на первом рендере = false. Alert не рендерится.
- **`transcript-editor.tsx` общий `error` перебивается между add/update/delete** — `useTransition` сериализует, handlers делают `setError(null)` на старте. Логика корректна.
- **`ReactionButton` данные расходятся с бэком** — React 19 `useOptimistic` автооткатывает state после transition end без revalidate. Data-integrity OK, но feedback отсутствует (см. M6).
- **`getMe` race** — React.cache дедуплицирует per-request. Layout и action — разные requests, поэтому между ними данные могут расходиться. Это документированный trade-off; бэк остаётся последним авторитетом.
- **`forbidden()` из `next/navigation`** — `experimental.authInterrupts: true` в `next.config.ts` есть, Next 16.1.4 поддерживает. OK.
- **`getUser` / `AuthUser` / `user.role === "admin"`** — grep по всему `src/` возвращает ноль результатов (кроме `getUsers` — другая функция, admin-листинг).
- **`AdminSidebar` active state** — `exact: true` для `/admin`, остальные pathname.startsWith. Работает корректно.
- **Модератор не редактирует чужие аннотации** — плановая регрессия, задокументирована в плане (строка 2116).
- **`logout` revalidate** — вызывает `revalidatePath("/", "layout")`, header обновится. OK.
- **`comment-item-actions.tsx` early return после hooks** — корректно (хуки вызываются безусловно).
- **Capability union типы** — все строки в `can(me, "...")` покрыты union'ом, опечаток нет.
- **`server-only` boundary** — `me.ts` и `permissions.ts` не утекают в client через runtime импорты.

---

## Приоритет фиксов

**Немедленно (security / data integrity):**
1. **C1** — `safeNext` open-redirect
2. **C3** — `user-status-inline` props drift

**Скоро (UX-регрессии):**
3. **C2** — forbidden branding в comments/annotations/register
4. **M1** — admin sub-page capability gate
5. **M4** — `?next=` chain через register

**При следующем рефакторинге:**
6. **M2, M3** — `LectureTable` / `UserTable` условный рендер кнопок
7. **M5** — `uploadFile` порядок guard/validation
8. **M6** — `ReactionButton` feedback
9. **M7** — suspended UX для comments (вместе с m9)
10. **m1** — `requireCapability` в comments/annotations actions
11. **m4, m5** — initialState паттерны унифицировать
12. **m7** — единый текст forbidden
13. **m13** — кастомный `admin/forbidden.tsx`
14. Остальные minor/nit — opportunistic

**Не трогать:**
- m8 (валидация до guard) — сначала обсудить продуктово
- m14 (`canModerateUsers` в sidebar) — зависит от бэк-контракта capability
- n1 (`me.role` в header) — продуктовое решение
- n4, n5 — осознанные решения

---

## Статус фиксов (update 2026-04-09)

Все 20 задач плана [docs/plans/2026-04-09-rbac-audit-fixes-plan.md](../plans/2026-04-09-rbac-audit-fixes-plan.md) исполнены субагентами в 3 волны + финальный sweep.

### Исполнено

- **C1** ✅ `2f8332b6` — safeNext regex fix (W1-01)
- **C2** ✅ `6b0c81b2` + `54d94831` — forbidden branding в публичных UI (W3-01, W3-02)
- **C3** ✅ `112af00d` — user-status-inline props drift (W1-02)
- **M1+M2+M3** ✅ `f1999cb3` — admin capability gating (W1-03)
- **M4** ✅ `96cf29a6` — `?next=` через register (W2-01)
- **M5** ✅ `06e86f9b` — uploadFile guard order (W1-04)
- **M6** ✅ `406268a4` — ReactionButton feedback (W1-05)
- **M7** ✅ `6b0c81b2` — suspended UX для comment-list (W3-01)
- **m1** ✅ `ab998725` — requireCapability в comments/annotations (W1-06)
- **m2** ✅ `112af00d` — user-status-inline a11y error (встроено в W1-02)
- **m3** ✅ `54d94831` — annotation-form role=alert (W3-02)
- **m4** ✅ `7bb28747` — file-manager initialState null (W1-07)
- **m5** ✅ `54d94831` — annotation-highlight editInitialState null (W3-02)
- **m6** ✅ `04ca8c35` — transcript-editor убран router.refresh (W1-08)
- **m7** ✅ `b059b40f` — единый текст forbidden (finalize sweep: заменены stale «Обновите страницу» строки в admin moderation UI)
- **m9** ✅ `6b0c81b2` — `whyCannotCreateComment` теперь используется (W3-01)
- **m10** ✅ `6b0c81b2` — comment-item dedup props (W3-01)
- **m11** ✅ `54d94831` — annotation-highlight dedup props (W3-02)
- **m12** ✅ `7cde46cf` — ActionResult.code union narrowed (W1-09)
- **m13** ✅ `19efff52` — admin/forbidden.tsx создан (W1-10)
- **n3** ✅ `9d8199ec` — RBAC секция в CLAUDE.md (W1-11)

### Отложено

- **m8** ⏭ спорное продуктовое решение про порядок «валидация vs guard» в create-actions
- **m14** ⏭ зависит от контракта бэка (`user.list ⊂ user.moderate` не документирован)
- **n1** ⏭ продуктовое решение (`me.role` vs `me.username` в header)
- **n2** ⏭ низкий приоритет (AdminNavItem в server-only работает через `import type`)
- **n4**, **n5** ⏭ осознанные решения, не требуют действий

Итого: 20 исполнено, 5 отложено.

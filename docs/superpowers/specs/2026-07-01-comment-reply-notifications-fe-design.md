# Уведомления об ответах на комментарии — фронтенд

Дата: 2026-07-01
Статус: дизайн одобрен, готов к плану

## Контекст и корректировка премисы

Задача звучала как «подписка/отписка на комменты введены на бэке, реализовать
новые ручки на фронте». Проверка `philosophy-api` показала, что **отдельных
per-comment `subscribe`/`unsubscribe` роутов бэк НЕ добавлял**. Реально
реализовано (коммиты `philosophy-api`, схема уже перегенерирована в
`src/api/schema.ts`):

1. **Неявная авто-подписка.** Ответ на чужой комментарий → автору *родителя*
   летит уведомление `comment.replied` (reason `reply`). Получатель резолвится
   напрямую как автор родителя (`ParentAuthorOf`), таблицы подписок для комментов
   и HTTP-ручки нет.
2. **Глобальный тумблер `notify_on_comment_reply`** (`preference.Preferences`,
   default `true`) — это и есть механизм «отписки»: выключил → перестал получать
   уведомления об ответах. Ручка — существующий `PATCH /api/me/preferences`,
   поле partial-patch (как appearance/locale/reading_mode).
3. Новые enum-значения: `notification.Type: "comment.replied"`,
   `notification.Reason: "reply"`, `notification.TargetType: "comment"`.

Таким образом фронтовая работа — это **два куска**: (A) глобальный тумблер
уведомлений и (B) рендер нового типа уведомления в инбоксе со ссылкой на ответ.

## Часть A — тумблер `notify_on_comment_reply`

Контрол «подписки/отписки» на ответы. Недеструктивный instant-toggle.

- **Эндпоинт:** `PATCH /api/me/preferences`, body `{ notify_on_comment_reply: boolean }`.
  Новых роутов нет. Partial-patch подтверждён как штатный паттерн слайса
  (persist-appearance патчит только appearance, persist-locale — только locale,
  `updatePreferences` — только reading_mode).
- **Дом фичи:** `src/features/preferences` (владеет эндпоинтом).
  - `actions.ts`: экшен `setNotifyOnCommentReply(next: boolean)` →
    `api.PATCH("/api/me/preferences", { body: { notify_on_comment_reply: next } })`
    → `rethrowApiError` → `revalidateEntity(Tags.PREFERENCES)`. Гейт
    `requireCapability(me, canUpdatePreferences)`. Возвращает `undefined`
    (сигнатура `createAction<boolean, void>` или вывод из аргумента).
  - `ui/comment-reply-notify-toggle.tsx`: клиентский компонент на kit `Checkbox`.
    Оптимистичный локальный стейт, `pending`-гард, `useToast` на ошибку
    (`toastActionError`), `router.refresh()` на успех. Паттерн —
    `HistoryTrackingToggle`, но БЕЗ confirm-диалога (недеструктивно). Проп
    `initialEnabled: boolean`, `canManage: boolean` (проброс `canUpdatePreferences(me)`).
- **Размещение:** секция «Подписки» (`sectionSubscriptions`) в
  `src/app/me/settings/page.tsx`, рядом с `SubscriptionsSection`. Начальное
  значение: `getPreferences()` → `notify_on_comment_reply ?? true` (дефолт бэка).
  Компонент импортируется из `@/features/preferences` (страница уже тянет и
  preferences, и notifications — cross-feature-гардов не нарушаем).
- **i18n:** ключи label/description/toast — в каталог `preferences`
  (ru/en/ar/zh). Пример: `commentReplyNotifyLabel`,
  `commentReplyNotifyDescription`, `savedTitle` (переиспользовать существующий,
  если есть).

## Часть B — рендер `comment.replied` в инбоксе

### Резолв ссылки на ответ (deep-link)

Уведомление несёт `target_type=comment`, `target_id=<id ответа>`, но контекста
родителя (лекции) в payload нет. **Блокера нет:** есть `GET /api/comments/{id}`,
а `comment.LectureID` — обязательное поле. Значит хост-страница резолвится
фронтом: `target_id → GET /api/comments/{id} → lecture_id →
"/lectures/{lecture_id}#comment-{target_id}"`.

Скролл использует **существующий** DOM-контракт: каждый узел дерева комментов
рендерится с `id=comment-<id>` (`comment-tree.tsx`, рекурсивно на все узлы, не
только корни), поэтому фрагмент попадает на **сам ответ**. Инфраструктура скролла
(`thread-scroll.ts`, `useScrollToCommentThread`, `commentNodeId`) уже есть и
используется `open-thread-button`. Конфликта с существующим кодом нет.

### Изменения

- **`types.ts`:** `AppNotification` получает поле `commentLectureId: string | null`
  (резолвнутый хост; `null` для не-comment-таргетов или если резолв не удался).
- **`api.ts` (сервер):** в `getNotifications` после нормализации — обогащение:
  для записей с `type === "comment.replied"` и непустым `targetId` параллельно
  (`Promise.all`) резолвим `GET /api/comments/{targetId}` → `lecture_id`.
  Отдельный `react cache`-хелпер `getCommentLectureId(id)`; при `error`/reject
  или удалённом комменте → `null` (мягкая деградация → карточка без ссылки).
  N+1 ограничен размером страницы (limit 20).
- **`notification-content.ts`:** новый дескриптор
  `{ kind: "commentReplied"; count: number; href: string | null }`. `href` =
  `commentLectureId && targetId ? "/lectures/${commentLectureId}#comment-${targetId}" : null`.
  `describeNotification` получает `commentLectureId` из уведомления (сигнатура
  принимает `AppNotification`, что и сейчас) и добавляет ветку
  `case "comment.replied"`. `entityHref` — ветку `comment` оставить `null`
  (fallback), т.к. href для коммента строится по-особому с фрагментом.
- **`notification-item.tsx`:** ветка рендера текста для `kind === "commentReplied"`
  через `t("commentReplied", { count })` (ICU-plural, как остальные).
- **i18n:** ключ `commentReplied` в каталог `notifications` (ru/en/ar/zh).
- **Скролл при переходе:** уведомление ведёт `router.push(href)` на другую
  страницу с хэшем. Проверить в browser-QA, что Next App Router доскроллит к
  `#comment-<id>` при client-nav (id — в SSR-HTML). Если нет — добавить на
  странице лекции hash-scroll-on-load через `useScrollToCommentThread` (клиентский
  островок, читающий `location.hash`). Реализовать fallback только если QA покажет
  проблему (YAGNI).

## Бэк-аски (флаг по AGENTS.md)

1. **Мягкий (не блокер).** Payload `comment.replied` не несёт контекст родителя
   → фронт делает N+1 `GET /api/comments/{id}` на резолв лекции. Попросить бэк
   добавить `lecture_id` (и, при возможности, флаг «тред под doc-view») прямо в
   уведомление, чтобы убрать N+1. После регена — снять FE-резолв, читать поле.
2. **Инфо.** `token?` query-param, появившийся в листинге комментов при этом
   регене, — это отдельная share-link работа, к данной фиче отношения не имеет.

## Тесты

- **preferences**
  - `actions`: `setNotifyOnCommentReply` — тело PATCH `{ notify_on_comment_reply }`,
    revalidate, forbidden-путь.
  - `comment-reply-notify-toggle`: оптимистичный флип, откат/тост при ошибке
    экшена, `disabled` при `!canManage`.
- **notifications**
  - `notification-content`: `describeNotification` для `comment.replied` — форма
    href при наличии `commentLectureId`, `null`-href без него.
  - `api`: обогащение — мок `GET /api/comments/{id}` → `lecture_id` кладётся в
    `commentLectureId`; ошибка GET → `null`; не-comment-типы не дергают GET.
  - `notification-item` (если есть рендер-тест): текст `commentReplied`.
- **i18n:** паритет ключа `commentReplied`/preferences-ключей по всем локалям
  (существующий guard-тест каталогов).

## Вне объёма (YAGNI)

- Per-comment / per-thread subscribe-UI — бэк такого не даёт (авто-подписка +
  глобальный mute).
- Изменения контракта уведомлений (это бэк-аск, не FE).
- CSV/массовые операции.

## Definition of Done

- `pnpm lint && pnpm test && pnpm build` зелёные.
- Тумблер в секции «Подписки» патчит `notify_on_comment_reply`, состояние
  переживает reload.
- `comment.replied` в инбоксе рендерится локализованным текстом и ведёт на
  `/lectures/{id}#comment-{replyId}`; удалённый коммент → карточка без ссылки, без
  краша.
- Бэк-аск №1 зафиксирован пользователю.
- Открыт browser-QA: скролл к ответу при переходе из инбокса; тумблер во всех
  локалях/RTL.

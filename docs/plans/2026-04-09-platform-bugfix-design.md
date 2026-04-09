---
name: Platform bugfix — 2026-04-09
description: Дизайн исправления находок ревью docs/reviews/2026-04-09-platform-review.md
date: 2026-04-09
---

# Дизайн: фикс находок платформенного ревью 2026-04-09

Источник: [docs/reviews/2026-04-09-platform-review.md](../reviews/2026-04-09-platform-review.md)

## Контекст

Ревью нашло 28 пунктов: 5 P0, 8 P1, 12 P2, 2 P3.

Из них **3 пункта требуют правки на бэке** (`philosophy-api`) и не могут быть исправлены на фронте без участия бэкенд-агента: P0-#1 (JWT `status`), P0-#15 (хардкод `status='published'` в репозиториях), P1-#4 / P1-#5 (отсутствие `user_id` в swagger-моделях `Comment`/`Annotation`). Плюс backend-gap по `GET /api/admin/users` (ссылается P2-#21 ревью).

Решение: всё, что зависит от бэка, выгружается в отдельный файл `docs/plans/2026-04-09-backend-bugs.md` для бэкенд-агента. Всё остальное чинится здесь параллельными фронт-агентами.

## Распределение работ

### Backend (отдельный файл `docs/plans/2026-04-09-backend-bugs.md`)

Пять пунктов:

1. **P0-#1** — JWT не содержит `status`. Файл: `philosophy-api/internal/user/service.go:66-70`. После фикса: фронт уберёт `user.status === "active"` в `comment-list.tsx`, `AuthUser.status` снова обязательное.
2. **P0-#15** — `status='published'` хардкод в `internal/comment/repo.go:47,56` и `internal/annotation/repo.go:99,101`. Решение: query-параметр `status=all|pending|hidden` в существующих эндпоинтах с проверкой роли, либо отдельные admin-эндпоинты. После фикса: страницы модерации фронта переключаются на новый источник, появляются вкладки/фильтр статуса.
3. **P1-#4** — добавить `user_id` в swagger-модель `Comment`. После фикса: фронт сравнивает `comment.user_id` с `user.id`, кнопки edit/delete показываются только автору.
4. **P1-#5** — то же для `Annotation`.
5. **Backend-gap (из P2-#21)** — сделать `GET /api/admin/users` (список с пагинацией). После фикса: фронт превращает `user-status-form.tsx` в настоящую таблицу.

Каждый пункт описывает: файл и строки бэка, корень, последствия, решение, и ровно тот фронт-follow-up, который понадобится.

### Frontend (этой сессией, через параллельных агентов)

Распределение по 8 изолированным группам. Файловые зоны не пересекаются — никаких git-конфликтов.

| # | Группа | Баги | Файлы (зона ответственности) |
|---|---|---|---|
| **A** | Аннотации UI | P0-#2, P0-#3, P3-#14 | `src/features/annotations/annotation-list.tsx`, `src/features/annotations/annotation-highlight.tsx` |
| **B** | Transcript editor | P0-#16, P1-#18, P3-#28 | `src/features/admin/lectures/transcript-editor.tsx` (+ возможно server actions, если нужен `router.refresh()`) |
| **C** | Admin/comment forms | P1-#17, P1-#19, P2-#11, P2-#24, P2-#25, P2-#10 | `src/features/admin/push/push-sender.tsx`, `src/features/admin/lectures/lecture-editor.tsx`, `src/features/admin/lectures/lecture-create-form.tsx`, `src/features/comments/comment-form.tsx` |
| **D** | Moderation UI | P1-#20, P2-#27, P2-#22 | `src/features/admin/comments/comment-moderation.tsx`, `src/features/admin/annotations/annotation-moderation.tsx`, `src/app/admin/comments/page.tsx`, `src/app/admin/annotations/page.tsx`, `src/features/admin/actions.ts` (только убрать локальный `type ModerationStatus`) |
| **E** | Users rename | P2-#21, P2-#23 | `src/features/admin/users/user-table.tsx` → `user-status-form.tsx`, `src/app/admin/users/page.tsx` |
| **F** | Routes loading/error | P2-#8 | новые: `src/app/login/{loading,error}.tsx`, `src/app/register/{loading,error}.tsx`, `src/app/search/{loading,error}.tsx` |
| **G** | Build/lint hygiene + CSS | P2-#9, P1-#7, P2-#12, P1-#6 | `package.json`, `src/features/player/use-video-player.ts`, `src/middleware.ts` (rename → `src/proxy.ts`), `src/features/auth/login-form.tsx`, `src/features/auth/register-form.tsx`, `src/features/search/search-results.tsx` |
| **H** | Dashboard | P2-#26 | `src/app/admin/page.tsx` |

### Pre-step (основная сессия — до запуска агентов)

В `src/api/types.ts` добавить два алиаса:

```ts
export type ModerationStatus =
  components["schemas"]["github_com_Mrartman14_philosophy-api_internal_moderation.ModerationStatus"];
export type UserStatus = NonNullable<UserUpdateStatusRequest["status"]>;
```

(Точный путь к схеме `ModerationStatus` уточняется при имплементации — пока ориентир на P2-#22.)

После этого:
- Группа D импортирует `ModerationStatus` и удаляет три локальных копии.
- Группа E импортирует `UserStatus` и удаляет хардкод.

Никто из агентов не пишет в `src/api/types.ts` — только читает.

## Дисциплина параллельных агентов

Каждый агент получает в промпте:

1. **Жёсткое требование `CLAUDE.md`:** НЕ делать `git stash/reset/checkout/clean`, НЕ делать `git add -A`/`git add .`, не трогать файлы вне своей зоны, не откатывать чужое.
2. **Точную зону ответственности** — список файлов и для каждого: цитата строк из ревью + ссылка на номер строки.
3. **Что делать с зависимостями:** бэкенд-зависимые баги (P0-#1, P0-#15, P1-#4, P1-#5) НЕ трогать — они в отдельном файле.
4. **Верификация в конце своего прохода:**
   - `npx tsc --noEmit`
   - `npx eslint <свои файлы>` (после фикса P2-#9 — `npm run lint` тоже)
5. **Никаких коммитов** — коммиты делает основная сессия.

## Финальный проход (основная сессия после всех агентов)

1. `npx tsc --noEmit` — должен быть чистым.
2. `npm run build` — должен пройти (после P2-#12 без warning о middleware).
3. `npm run lint` — должен работать и быть чистым (после P2-#9 + P1-#7).
4. Один коммит на ветке `main` со всеми правками (или серия по группам — решит пользователь).

## Что НЕ делается этим прогоном

- Бэкенд-зависимые баги (P0-#1, P0-#15, P1-#4, P1-#5) — выгружены в `docs/plans/2026-04-09-backend-bugs.md`.
- Любой рефакторинг сверх требований ревью.
- Изменения в файлах, которые не упомянуты в зонах групп.

## Риски

- **`src/api/types.ts` алиас P2-#22**: точное имя схемы `ModerationStatus` в `src/api/schema.ts` нужно проверить эмпирически — путь в ревью предположительный.
- **P2-#12 (middleware → proxy)**: переименование `src/middleware.ts` в `src/proxy.ts` может потребовать также обновления конфигов Next.js. Проверить документацию Next 16 в момент имплементации; если ломает — оставить как warning и описать тикет.
- **P0-#16 (transcript-editor RSC рефакторинг)**: возможно, потребует изменений серверных actions или схемы `revalidatePath`. Группа B имеет право трогать `src/features/admin/actions.ts` ТОЛЬКО для добавления `revalidatePath` в transcript-actions, ничего больше там не изменяя (чтобы не конфликтовать с Группой D).
- **P2-#26 (dashboard метрики)**: если в `src/api/schema.ts` нет нужных эндпоинтов с `total` для users/comments/annotations/push — Группа H оставляет TODO в UI и не выходит за зону.

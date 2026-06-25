# Карточка лекции: управление + рендер вложений

**Дата:** 2026-06-25
**Статус:** одобрено (дизайн)
**Слайс:** `src/features/lectures`, `src/app/admin/lectures`, новый примитив `src/components/ui/tabs.tsx`

## Проблема

Сейчас у админ-лекции нет собственной страницы: `/admin/lectures/[id]` → 404 (нет
`page.tsx`), а управление вложениями вынесено на отдельную страницу
`/admin/lectures/[id]/attachments` ([page.tsx](../../../src/app/admin/lectures/[id]/attachments/page.tsx)) —
два `LectureAttachmentsManager` (документы + медиа), но документы там только
перечислены ссылками, тело не рендерится.

Нужно: убрать отдельную страницу attachments и собрать всё на «карточке лекции»
`/admin/lectures/[id]`, где документ **рендерится** (а не просто линкуется),
несколько документов показываются вкладками, и при этом **грузится тело только
одного** документа за раз.

## Решение (одобренные ответы)

- **«Основной» документ:** в контракте бэка флага нет (см. §«Бэкенд-флаг»). Активной
  вкладкой становится **первый по `sort_order`** (список уже упорядочен) — помеченный
  стопгап до появления явного флага.
- **Композиция:** управление вложениями сверху, рендер ниже.
- **Медиа:** тоже рендерим превью (плеер), не только список-менеджер.

## Архитектура

### Роутинг
- **Удалить** `src/app/admin/lectures/[id]/attachments/page.tsx` и пустую папку
  `attachments/`.
- **Создать** `src/app/admin/lectures/[id]/page.tsx` — карточка лекции (server
  component).
- **Перенаправить ссылки:**
  - В [edit/page.tsx](../../../src/app/admin/lectures/[id]/edit/page.tsx) секция
    «вложения» сейчас линкует на `…/attachments` → вести на `/admin/lectures/{id}`.
  - Проверить `lecture-admin-row.tsx`: строка списка должна вести на карточку
    (а не сразу на edit), если ведёт иначе — поправить.
- **RBAC (Layer-3):** `const me = await getMe(); if (!canManageAttachments(me, lecture)) forbidden();`
  — owner-only, идентично прежней attachments-странице. `notFound()` если лекции нет.

### Структура карточки (сверху вниз)

1. **Заголовок** лекции (`lecture.title`) + ссылка «Редактировать» → `/admin/lectures/{id}/edit`.
2. **Управление вложениями** — переиспользуем существующие компоненты без изменений:
   - `LectureAttachmentsManager` (документы, `pickerEntityType="document"`).
   - `LectureAttachmentsManager` (медиа, `pickerEntityType="media"`).
   - Данные/фетчеры/`canAttach` — переносим из текущей attachments-страницы один-в-один.
3. **Рендер документов:**
   - 0 документов → секция не рендерится.
   - 1 документ → `<article class="content"><AstRender blocks=… /></article>` без вкладок.
   - ≥2 документов → вкладки (новый `Tabs`-примитив), вкладка на документ
     (`label = filename ?? id`), активная — первая по `sort_order`.
4. **Рендер медиа:**
   - Под документами, секция «Медиа».
   - Для каждого медиа — `MediaPlayer` (`url`, `type`, `filename`, `mediaId`).
     `media.FileType` = `audio | video` (изображений нет — «превью» это плеер).
   - Нет `url` → фолбэк-текст «недоступно», как в [media-detail.tsx](../../../src/features/media/ui/media-detail.tsx).

### Ленивая загрузка тела документа (ключевой инвариант: грузится один)

Бэкенд уже разделяет метаданные и тело:
- `GET /api/lectures/{id}/documents` → `document.Document[]`, но `blocks: []`
  (режим-сводка; проверено на живом стенде: список → 0 блоков).
- `GET /api/documents/{id}` → полное тело (`blocks` заполнены).

Механика:
- **Список** (`getLectureDocuments`) даёт метаданные вкладок: `id`, `filename`,
  порядок по `sort_order`.
- **Основной** документ: страница (server) тянет `getDocumentById(primaryId)` из
  публичного API `@/features/documents` и рендерит `AstRender` server-side; этот
  готовый узел передаётся в client-компонент вкладок пропом (`primaryPanel`).
- **Прочие** вкладки: client-компонент `LectureDocumentTabs` рендерит для них
  `LazyDocPanel`, который при **первой активации** вкладки зовёт server action
  `loadLectureDocumentBlocks(docId)` → получает `blocks` → рендерит `AstRender`
  на клиенте (`AstRender` — чистый компонент без `server-only`, работает на
  клиенте). Результат кэшируется в состоянии (`Map<docId, blocks>`), повторное
  открытие вкладки не делает повторный запрос.
- **Server action** `loadLectureDocumentBlocks` живёт в
  `src/features/lectures/actions.ts`, внутри зовёт `getDocumentById` из
  `@/features/documents` (публичный API через `index.ts` — cross-feature импорт
  разрешён, не deep-import). Возвращает `{ success, data: blocks }`/ошибку.

### Новый примитив ui-kit: `src/components/ui/tabs.tsx`

- Обёртка над **Base UI Tabs** (`@base-ui-components/react/tabs`), по конвенциям
  кита: закрытый `className` на leaf-частях, токены (`--color-*`), `compact`-режим,
  Guardrail 7 (kit-only, без нативных интерактивных тегов вне kit) и Guardrail 8.
- Минимальный API: `Tabs.Root / Tabs.List / Tabs.Tab / Tabs.Panel` (ре-экспорт
  частей Base UI в стилизованных обёртках), значение вкладки = `value` (id документа).
- Экспорт из [src/components/ui/index.ts](../../../src/components/ui/index.ts).
- **Зона заморожена** (AGENTS.md: новые примитивы kit — отдельным обсуждением);
  добавление **явно санкционировано пользователем** в рамках этой задачи.

## Поток данных

```
page.tsx (server)
  ├─ getMe(), getLectureById(id)         → RBAC-гейт + заголовок
  ├─ getLectureDocuments(id)             → метаданные вкладок (blocks пустые)
  ├─ getLectureMedia(id)                 → медиа (для менеджера + плееров)
  ├─ primary = docs[0] (sort_order)      → getDocumentById(primary.id) (тело)
  ├─ <LectureAttachmentsManager docs/>   (управление)
  ├─ <LectureAttachmentsManager media/>  (управление)
  ├─ <LectureDocumentTabs                (рендер; client)
  │      docs={meta} primaryId
  │      primaryPanel={<AstRender server/>}
  │      loadBlocks={loadLectureDocumentBlocks} />
  └─ media.map(<MediaPlayer/>)           (рендер превью)

LectureDocumentTabs (client)
  └─ активация неосновной вкладки → loadLectureDocumentBlocks(docId)
       → AstRender(blocks) на клиенте, кэш в Map
```

После attach/detach/reorder в менеджере срабатывает `revalidateEntity` — страница
ре-рендерится, набор вкладок и порядок обновляются автоматически (server-driven).

## Бэкенд-флаг (по правилу AGENTS.md «флаговать корень»)

В схеме нет признака «основного» документа: `document.Document` и
`attachment.AttachmentDTO` несут только `sort_order`; `is_primary`/`main`/`featured`
отсутствуют (grep по `src/api/schema.ts` пуст).

**Требование бэку:** добавить явный признак основного документа лекции — либо
`is_primary: bool` на элементе ответа `GET /api/lectures/{id}/documents`, либо
`primary_document_id` на сущности лекции. Семантика: какой документ открывается
первым на карточке.

**Стопгап (FE):** до появления флага активной вкладкой берётся первый по
`sort_order`. В коде помечается комментом со ссылкой на этот spec; снимается, когда
бэк выровняет контракт (схема перегенерирована).

## Тестирование

- **Tabs-примитив** (`tabs.test.tsx`): рендер, переключение `value`, a11y-роли
  (`tablist`/`tab`/`tabpanel`), `compact`.
- **Ленивость** (`lecture-document-tabs.test.tsx`): на старте отрендерён только
  основной; активация второй вкладки вызывает `loadBlocks` ровно один раз; повторное
  открытие — без повторного вызова (кэш).
- **Выбор основного:** первый по `sort_order` становится активным/server-fetched.
- **RBAC:** не-owner → `forbidden()`; отсутствующая лекция → `notFound()`.
- **Медиа:** есть `url` → `MediaPlayer`; нет `url` → фолбэк.

## Запретные зоны / границы

- `src/components/ui/tabs.tsx` + `index.ts` — заморожённый kit, добавление
  санкционировано (см. выше). Других примитивов не трогаем.
- `src/api/schema.ts` — не трогаем (флаг — на стороне бэка).
- Переиспользуем `LectureAttachmentsManager`, `AstRender`, `MediaPlayer`,
  `getDocumentById` как есть.

## Критерий готовности

Зелёные `pnpm lint && pnpm test && pnpm build`. Ручная браузер-проверка:
карточка открывается, управление работает, основной документ рендерится сразу,
переключение вкладок подгружает тело лениво, медиа-плееры на месте.

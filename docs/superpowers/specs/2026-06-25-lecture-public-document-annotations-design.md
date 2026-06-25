# Унификация страницы лекции: общий просмотр + инлайн-документы с аннотациями

**Дата:** 2026-06-25
**Статус:** одобрено (дизайн; обновлён под унификацию страниц)
**Область:** `src/app/lectures/[id]/page.tsx` (единая страница), `src/features/lectures` (хелпер выбора + презентационный селектор), удаление admin-карточки `src/app/admin/lectures/[id]/page.tsx`, переиспользование `DocumentAnnotations`/`MediaPlayer` без изменений.

## Проблема

Две отдельные страницы лекции — admin-карточка `/admin/lectures/[id]` (owner-only просмотр) и публичная `/lectures/[id]` (читатели) — избыточны. Канонический паттерн (как у `/documents/[id]`): **одна страница лекции для всех**, где привилегированный пользователь видит те же данные **плюс** контролы по capability. Параллельно: на странице документа можно оставлять аннотации, а на странице лекции документы вообще не рендерятся (только ссылки), и её лейаут — центрированный `max-w-3xl` мимо грид-полей.

## Одобренные решения

- **Унификация:** единственная страница лекции — `/lectures/[id]`. Admin-карточка `/admin/lectures/[id]` **удаляется**; ссылки на неё (admin-строка, редирект формы создания) ведут на `/lectures/[id]`.
- **Admin-affordance:** на `/lectures/[id]` — ссылка «Редактировать лекцию» → `/admin/lectures/[id]/edit`, по `canUpdateLecture` (минимально; всё управление — на `/edit`).
- **Документы:** рендерятся инлайн (URL-driven `?doc=<id>`, ленивость); аннотации активного документа — в правом поле; привязка к документу (общие с `/documents/[id]`).
- **Медиа:** рендерятся **плеерами** (audio/video) для всех (переезд логики admin-карточки), вместо списка-ссылок.
- **Лейаут:** общий `.page-grid` (хребет + поля), как `/documents/[id]`.

## Архитектура

### 1. Единый лейаут `.page-grid`

[/lectures/[id]/page.tsx](../../../src/app/lectures/[id]/page.tsx) сейчас в `mx-auto max-w-3xl`. Переводим на структуру `/documents/[id]`: контент — прямые дети грида (хребет), колонка аннотаций — `MarginNote side="end"` (прямой ребёнок грида). Без центрирующей обёртки.

### 2. Кросс-фичевая композиция — на странице (app)

ESLint запрещает `@/features/*` внутри слайса. Поэтому фетч тела документа (`getDocumentById`), `DocumentDetail`, `DocumentAnnotations`, `getMediaById`, `MediaPlayer` — **на странице** (`src/app/**`, там разрешено). Слайс `lectures` даёт лишь чистый `resolveActiveDocId` + презентационный `LectureDocumentSelector`.

### 3. Документы: URL-driven выбор + инлайн-рендер + аннотации

- `getLectureDocuments(id, token)` → видимые документы; `resolveActiveDocId(documents, ?doc)` → активный (валидный `?doc` или дефолт «первый по sort_order», СТОПГАП до `is_primary`).
- Селектор: строка-ссылок `?doc=<id>` (сохраняя token), активная — `aria-current` + акцентный стиль; ≤1 документа → не рендерится.
- Тело активного: `getDocumentById(active, token)` в `<div data-ast-root>` через `DocumentDetail`; в DOM ровно один `data-ast-root` → инвариант движка (`querySelector("[data-ast-root]")`) соблюдён. Null → фолбэк-сообщение, страница жива.
- Аннотации: `<DocumentAnnotations parentId={active}/>` в `MarginNote side="end"` — **без изменений**. Создание — по `canCreateAnnotation`.
- **Ленивость by construction:** переключение `?doc` = навигация; сервер грузит только активный документ + его аннотации.

### 4. Медиа: инлайн-плееры

- `getLectureMedia(id, token)` → медиа; на каждый — `MediaPlayer` (`media.FileType` = audio|video). `url` в списке опционален → добираем `getMediaById` ТОЛЬКО когда пуст (без N+1). Нет url → фолбэк «недоступно». (Переезд блока с удаляемой admin-карточки.)

### 5. Admin-affordance (edit-link)

- На странице: `{canUpdateLecture(me, lecture) && <RouterLink href={`/admin/lectures/${id}/edit`}>Редактировать лекцию</RouterLink>}` (правый верх, как share/subscribe-слоты). Анонимы/читатели его не видят.

### 6. Ретирование admin-карточки

- Удалить `src/app/admin/lectures/[id]/page.tsx`.
- Перенаправить ссылки на неё → `/lectures/[id]`:
  - `lecture-admin-row.tsx` (заголовок строки),
  - `lecture-create-form.tsx` (редирект после создания при выбранных документах — сейчас ведёт на карточку).
- `/admin/lectures/[id]/edit` — остаётся (управление).

### 7. Видимость / токен / SSR

- Показываем только документы/медиа, видимые зрителю. **Флаг бэку:** подтвердить фильтрацию по видимости для анонима/зрителя на `GET /api/lectures/{id}/documents`, `/media`, `/api/documents/{id}` — иначе приватные утекут на публичную страницу.
- `?token=` (share-link) пробрасываем в `getLectureById/Documents/Media` и `getDocumentById`, сохраняем в ссылках селектора.
- SSR/no-JS: грид + SSR-фолбэк коннектора аннотаций; ссылки `?doc=` — реальная навигация.

## i18n

- **Добавить** (namespace `pages`): `lectureEditLink`, `lectureDocumentsNavLabel`, `lectureDocumentUnavailable`, `lectureMediaHeading`, `lectureMediaUnavailable` (4 локали).
- **Удалить мёртвые** (вместе с удаляемыми компонентами/карточкой): namespace `lectures` — `documentsSectionLabel`, `documentsSectionHeading`, `mediaSectionLabel`, `mediaSectionHeading`; namespace `admin` — `cardMetaTitle`, `cardMediaHeading`, `cardMediaUnavailable`.

## Поток данных

```
/lectures/[id]?doc=<D>&token=<T>  (server, единая страница)
  ├─ getLectureById(id,T) (404→notFound), getLectureDocuments(id,T), getLectureMedia(id,T)
  ├─ active = resolveActiveDocId(documents, D);  activeDoc = getDocumentById(active,T)
  ├─ ХРЕБЕТ: [canUpdate→edit-link], LectureDetail, экспорт,
  │     [селектор + <div data-ast-root><DocumentDetail active></div>],
  │     медиа-плееры, комменты…
  └─ ПОЛЕ: <DocumentAnnotations parentId={active}/>  (если activeDoc)
Переключение ?doc → навигация → другой active (ленивость). Admin видит edit-link.
```

## Граничные случаи

- 0 документов → нет секции документов/аннотаций. 1 документ → без селектора, рендер напрямую.
- `?doc` невалиден → дефолт. `getDocumentById→null` → фолбэк, страница жива.
- 0 медиа → нет медиа-секции. Медиа без url → «недоступно».
- Приватная лекция: не-владелец без токена → `getLectureById→null`→ notFound; владелец → видит (+ edit-link).
- no-JS → ссылки `?doc=` работают; активный документ + аннотации SSR.

## Вне области (YAGNI)

- Быстрые admin-контролы на странице (visibility-тоггл/delete) — нет, только edit-link; управление на `/edit`.
- Мгновенный клиентский свитч документов (RSC-из-actions) — отклонено в пользу URL-driven.
- TOC активного документа в левом поле — возможное последующее улучшение.
- Admin-карточка как редирект-страница — нет, удаляется (ссылки перенаправлены).

## Тестирование

- `resolveActiveDocId`: дефолт/валид/невалид/пусто/без-id.
- `LectureDocumentSelector`: ссылки + `aria-current` + токен; ≤1 → null.
- Страница (build + ручной приём): один `data-ast-root`; edit-link только при canUpdate; медиа-плееры; аннотации совпадают с `/documents/[id]`; приватные документы/медиа не видны анониму; общий грид.
- Нет висящих ссылок на удалённый роут `/admin/lectures/[id]`.

## Критерий готовности

Зелёные `pnpm lint && pnpm test && pnpm build`. Ручной приём: лекция с ≥2 документами на `/lectures/[id]` — селектор + инлайн-документ + ленивое `?doc` + аннотации в поле + медиа-плееры; админ видит «Редактировать»; `/admin/lectures/[id]` → 404, ссылки ведут на `/lectures/[id]`.

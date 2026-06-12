# Программа покрытия philosophy-api фронтендом — дизайн

Дата: 2026-06-12
Статус: на ревью

## 1. Цель

Довести фронтенд до покрытия всех фич бекенда philosophy-api (~165 операций, 20 доменов), кроме canvas (отложен целиком, см. «Вне скоупа»). Работа ведётся сетью субагентов под управлением менеджер-сессии; менеджер код не пишет и не правит.

## 2. Контекст

**Уже реализовано:** auth, glossary, lectures (без cover, тегов и attachments), AST-редактор Phase 1, ast-render.

**Готовые планы (выполняются в этой программе):** AST Editor Phase 2a (image), 2b (pickers), 2c (toolbar) — `docs/superpowers/plans/2026-05-01-ast-editor-phase-2*.md`.

**Нормативные документы (обязательны для каждого плана и исполнителя):**

- [docs/frontend-conventions.md](../../frontend-conventions.md) — слайс-структура, SSR, формы, RBAC, кеш-инвалидация, тесты.
- [src/features/_template/README.md](../../../src/features/_template/README.md) — чеклист готовности фичи.
- CLAUDE.md — правила параллельной работы агентов и запретные зоны.
- Репозиторий бекенда: `/Users/alexander.borisenko/Documents/philosophy-api` (принципы — `docs/design/principles.md`, конвенции — `docs/conventions/*.md`).

## 3. Скоуп — волны

Внутри волны фичи выполняются параллельно (каждая в своём worktree), мержи в локальный `main` — последовательные. Следующая волна стартует после завершения предыдущей.

### Волна 1 — мелкие независимые фичи + AST Phase 2

| Фича | API | UI-поверхности |
| --- | --- | --- |
| `ast-editor-phase-2` | `POST /api/uploads/images`, picker-GETы | Выполнение готовых планов 2a → 2b → 2c последовательно одной цепочкой. **Canvas-picker из 2b исключается.** |
| `tags` | `GET /api/tags`; admin CRUD `/api/admin/tags`; `PUT /api/admin/lectures/{id}/tags` | `/admin/tags` (CRUD); назначение тегов в admin-форме лекции; отображение тегов на карточке/странице лекции; фильтр лекций по тегу |
| `events` | admin CRUD `/api/admin/events` (+ревизии, .md/.txt); `GET /api/calendar` | `/admin/events` (CRUD + ревизии); публичная страница `/calendar` |
| `banners` | admin CRUD `/api/admin/banners` (+ревизии); `GET /api/banners/active`; `POST /api/banners/{id}/dismiss` | `/admin/banners` (CRUD + ревизии); показ активных баннеров site-wide (foundation-touch в root layout); dismiss-кнопка |
| `users-admin` | `GET /api/admin/users`; `PUT …/role`; `PUT …/status` | `/admin/users`: список, смена роли/статуса. Гарды «не себя» и «не последнего админа» enforce'ит бек — фронт показывает его ошибки |
| `audit` | `GET /api/admin/audit` | `/admin/audit`: просмотр с фильтрами (actor, target_type/id, action, даты) |
| `preferences-push` | `GET/PATCH /api/me/preferences`; `GET /api/push/vapid-key`; `POST/DELETE /api/push/subscribe`; `POST /api/admin/push/send` | Страница настроек `/settings`; подписка/отписка push; admin-форма рассылки `/admin/push` |

### Волна 2 — контентное ядро

| Фича | API | UI-поверхности |
| --- | --- | --- |
| `comments` | `GET/POST /api/lectures/{id}/comments`, search, subtree (+.md/.txt), `PUT /api/comments/{id}/blocks`, `DELETE`, реакции, ревизии, `GET /api/admin/comments` | Дерево комментариев на странице лекции; создание/редактирование через AST-редактор; реакции (toggle); поиск; ревизии; admin-список с delete_any |
| `documents` | `GET /api/documents` (picker), `POST /api/documents` и `/upload`, `GET/{id}` (+.md/.txt), `PATCH`, `DELETE`, `PUT …/blocks`, `PATCH …/visibility`, ревизии, attachments, `GET /api/me/documents`, `GET /api/admin/documents` | `/documents/my`; страница документа `/documents/[id]`; создание (JSON и upload); редактирование blocks; видимость; ревизии; список лекций-контейнеров; admin-список с delete_any |
| `media` | `GET/POST /api/media`, `GET/{id}`, `DELETE`, `PATCH …/visibility`, attachments, `GET /api/me/media`, `GET /api/lectures/{id}/media` | `/media/my`; создание; просмотр; удаление; видимость; admin delete_any |
| `annotations` | `POST /api/entities/{type}/{id}/annotations`, `GET/PUT/DELETE /api/annotations/{id}` (+.md/.txt), ревизии, `GET /api/me/annotations`, `GET /api/lectures/{id}/annotations`, `GET /api/admin/annotations` | Аннотации на странице лекции/документа; создание (видимость фиксируется при создании); мои аннотации; ревизии; admin-список с delete_any |

### Волна 3 — составные фичи

| Фича | API | UI-поверхности |
| --- | --- | --- |
| `forms` | `POST /api/forms`, `GET/PATCH/DELETE /api/forms/{id}`, submissions (`POST/GET /api/forms/{id}/submissions`, `GET/PATCH/DELETE /api/submissions/{id}`, `POST …/retract`), `GET /api/me/forms`, `GET /api/me/submissions`, `GET /api/admin/forms` | Конструктор форм (fields builder); publish-workflow; заполнение формы; отклики по режимам editable/immutable; мои формы/отклики; отклики владельцу формы; admin-список с delete_any |
| `trails` | `GET/POST /api/trails`, `/my`, `GET/PUT/DELETE /{id}`, `PUT …/items`, `PATCH …/visibility`, `GET /api/admin/trails` | Списки трейлов; страница трейла; CRUD; управление items (порядок); видимость; admin-список с delete_any |
| `share-links` | `GET/POST /api/share-links`, `DELETE /{token}`, admin `GET /api/admin/share-links`, `DELETE` | Создание ссылки из страниц document/media/form/lecture; список своих ссылок; revoke; admin-модерация |
| `search` | `GET /api/search` | Страница `/search`; точка входа в header (foundation-touch) |
| `lecture-enrichment` | cover (`GET/PUT/DELETE /api/lectures/{id}/cover`), attachments (`POST/PATCH/DELETE /api/lectures/{lectureID}/attachments/…`), `GET /api/lectures/{id}/documents`, `…/media`, `…/tags` | Cover в admin-форме лекции; управление attachments (attach/detach/reorder); блоки документов/медиа на странице лекции |

Точную состыковку «кто рендерит чей блок на странице лекции» определяют планы волн 2–3: страницы в `src/app` компонуют несколько фич через их публичные `index.ts` — кросс-фичевые импорты запрещены.

## 4. Вне скоупа

- **Canvas целиком**: фича canvases, canvas-picker из плана 2b, визуальный редактор графов. Возвращаемся отдельной программой.
- Регенерация `src/api/schema.ts` (запретная зона).
- E2e- и скриншот-тесты (по конвенциям проекта не пишем).
- `.md`/`.txt`-выгрузки рендерит бек — фронт даёт только ссылки.

## 5. Оркестрация

**Роли:**

- **Менеджер** (эта сессия): декомпозиция, запуск агентов, контроль мержей, отчёты. Кода не пишет.
- **Plan-агент** (на фичу): пишет план по skill writing-plans → `docs/superpowers/plans/2026-06-12-<feature>.md`, опираясь на эту спеку, конвенции и schema.ts.
- **Исполнители**: выполняют план в изолированном git worktree (skill subagent-driven-development / executing-plans).
- **Ревьюер**: code-review-субагент по диффу фичи перед мержем.

**Протокол мержа:**

1. Фича готова в worktree, чеклист `_template/README.md` пройден.
2. `npm run lint && npm test && npm run build` — зелёные в worktree.
3. Code-review-субагент: замечания уровня bug / нарушение конвенций исправляются до мержа.
4. Менеджер мержит ветку в локальный `main` (push заблокирован — всё локально). Мержи строго последовательные; после мержа следующая ветка ребейзится/мержит main при конфликтах.

**Foundation-touch протокол:** запретные зоны (`src/app/layout.tsx`, `admin-sidebar.tsx`, `app-header.tsx`, `src/components/ui/*`, `src/utils/*`, конфиги) фичи не трогают. Навигация в sidebar/header, баннеры в root layout — отдельные `foundation-touch` коммиты, выполняются последовательно выделенным агентом после мержа соответствующей фичи (прецедент: `feat(auth): wire login/logout UI into app-header (foundation-touch)`).

**Правила для каждого субагента (передаются в промпт дословно):** никаких `git stash/reset/checkout ./clean`; `git add` только своих файлов по имени; не откатывать чужие изменения; передавать эти правила своим субагентам.

## 6. Бизнес-правила бекенда (обязательны для всех планов)

1. **Видимость иммутабельна вниз**: public → private запрещён (422 `PUBLIC_IMMUTABLE`). UI не предлагает даунгрейд — только private → public.
2. **Admin power split**: админ НЕ редактирует пользовательский контент (documents, media, annotations, trails, forms, comments) — только удаление public-сущностей через `*.delete_any`. Никаких admin-edit форм для этих сущностей.
3. **`entity.attach` есть только у роли user** — админ управляет attachments только как владелец лекции. UI-проверки строить на capabilities из `getMe()`, не на роли.
4. **Формы**: после publish структура заморожена (бек вернёт ошибку); режимы откликов: editable (edit/delete) vs immutable (только retract); retract оставляет tombstone — повторная отправка получает 409 `ALREADY_SUBMITTED`.
5. **Отклики видят только автор и владелец формы.** Никаких admin-просмотров откликов и доступа по share-token.
6. **Comments не имеют собственной видимости** — наследуют периметр лекции.
7. **Видимость annotation фиксируется при создании** и не меняется.
8. **Suspended-пользователь** читает, но не пишет — обрабатывать 403 `SUSPENDED` понятным текстом.
9. **403 forbidden** → branded-текст «У вас нет прав на <действие>.»; 404 — secure-by-default (бек не раскрывает существование).
10. **409 `DOCUMENT_REFERENCED` / `LECTURE_REFERENCED`** при удалении — показывать понятную ошибку «на сущность ссылаются».
11. **Реакции** — per-user toggle, без подтверждений.
12. **Удаления аккаунтов нет** — только ban/suspend.

## 7. Качество

- Чеклист `_template/README.md` обязателен для каждой фичи.
- Тесты обязательны: permissions (4+ кейса на каждый `can*`), schemas (success + failure на каждую Zod-схему).
- ESLint-гарды (изоляция слайсов) должны проходить без отключений правил.
- RBAC-паттерн: `requireCapability` в server actions, `canX()` в server components, boolean-пропсы в client.
- Кеш: `React.cache` + `unstable_cache` с тегами, инвалидация через `revalidateEntity`.

## 8. Отчётность

Полная автономия в пределах волны. После каждой волны — отчёт: что смержено, отклонения от спеки, риски, план следующей волны. Деструктивные действия и push не выполняются (push заблокирован в настройках).

## 9. Риски и митигейшены

- **Конфликты в shared-файлах** (страница лекции, роуты) → последовательные мержи + foundation-touch протокол; фичи волн 2–3, касающиеся страницы лекции, мержатся с явным порядком.
- **`public/sw.js` имеет незакоммиченный чужой diff** → не трогать; перед `preferences-push` выяснить происхождение и согласовать.
- **Большие фичи (forms, comments, documents)** → планы дробятся на этапы с отдельными коммитами; допускается разбивка на под-планы.
- **Дрейф schema.ts vs реальный бек** → при противоречии источник истины — репозиторий бекенда; schema.ts не регенерировать, расхождения эскалировать пользователю.
- **AST Phase 2b писался с canvas-picker** → Plan-агент фиксирует исключение canvas до старта выполнения.

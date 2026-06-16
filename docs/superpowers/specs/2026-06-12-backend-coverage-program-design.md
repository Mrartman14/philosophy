# Программа покрытия philosophy-api фронтендом — дизайн

Дата: 2026-06-12 (rev 2 — после трёхлинзового агентного ревью: корректность против бекенда, полнота/симметрия, архитектура)
Статус: на ревью

## 1. Цель

Довести фронтенд до покрытия всех фич бекенда philosophy-api (165 операций, 20 доменов), кроме canvas (отложен целиком, см. «Вне скоупа»). Работа ведётся сетью субагентов под управлением менеджер-сессии; менеджер код не пишет и не правит.

## 2. Контекст

**Уже реализовано:** auth (без регистрации), glossary (без ревизий/выгрузок), lectures (без cover, тегов и attachments), AST-редактор Phase 1, ast-render.

**Готовые планы (выполняются в этой программе):** AST Editor Phase 2a (image), 2b (pickers), 2c (toolbar) — `docs/superpowers/archive/2026-05-01-ast-editor-phase-2*.md` (перемещены в архив как выполненные).

**Нормативные документы (обязательны для каждого плана и исполнителя):**

- [docs/frontend-conventions.md](../../frontend-conventions.md) — слайс-структура, SSR, формы, RBAC, кеш-инвалидация, тесты.
- [src/features/_template/README.md](../../../src/features/_template/README.md) — чеклист готовности фичи.
- CLAUDE.md — правила параллельной работы агентов и **полный** список запретных зон (здесь не пересказывается; ниже упоминаются только зоны с запланированным foundation-touch). Не заморожены: `src/components/ast-editor`, `src/components/ast-render`, `src/components/markdown-editor` и новые директории в `src/components/`.
- Репозиторий бекенда: `/Users/alexander.borisenko/Documents/philosophy-api` (принципы — `docs/design/principles.md`, конвенции — `docs/conventions/*.md`). **При расхождении со schema.ts источник истины — бекенд** (известные расхождения — §10).

## 3. Скоуп — волны

Внутри волны фичи выполняются параллельно (каждая в своём worktree), мержи в локальный `main` — последовательные. Следующая волна стартует после завершения предыдущей.

### Волна 1 — мелкие независимые фичи + AST Phase 2

| Фича | API | UI-поверхности и примечания |
| --- | --- | --- |
| `ast-editor-phase-2` | `POST /api/uploads/images`, picker-GETы | Цепочка: 2a → 2b → 2c → **интеграционный шаг** (image-кнопка в toolbar, RefMenu-trigger, @-suggestion — follow-up'ы из плана 2c) → **ast-render catch-up** (image по `storage_key` через общий resolveStorageUrl; марки `media_ref`, `comment_ref`) — один владелец, без него контент волны 2 не отрендерится публично. Canvas-picker: код уже в main (`src/components/ast-editor/pickers/canvas-picker.tsx`) — оставить dormant, в RefMenu не подключать, не развивать |
| `tags` | `POST /api/admin/tags`, `PUT/DELETE /api/admin/tags/{id}`; список — публичный `GET /api/tags`; `PUT /api/admin/lectures/{id}/tags`; фильтр `?tag=` на `GET /api/lectures` | `/admin/tags` (create/update/delete, список из публичного GET); назначение тегов — компонент слайса `tags`, компонуется страницей `src/app/admin/lectures/[id]/edit` рядом с LectureEditForm; отображение тегов на карточке/странице лекции и tag-фильтр — правки **внутри слайса `lectures`**, выполняет ветка `tags` (в волне 1 другие фичи эти файлы не трогают) |
| `events` | admin CRUD `/api/admin/events` (+ревизии, .md/.txt); `GET /api/calendar` | `/admin/events` (CRUD + ревизии); публичная страница `/calendar`. **Владелец generic-компонента `src/components/revision-history/`** (данные/actions передаются пропами из слайса) — мержится первой в волне 1, остальные переиспользуют |
| `banners` | admin CRUD `/api/admin/banners` (+ревизии, .md/.txt); `GET /api/banners/active`; `POST /api/banners/{id}/dismiss` | `/admin/banners` (CRUD + ревизии + ссылки .md/.txt); показ активных баннеров site-wide (foundation-touch в root layout); dismiss требует auth — анониму кнопку не показывать (или локальный фоллбек) |
| `users-admin` | `GET /api/admin/users`; `PUT …/role`; `PUT …/status` | `/admin/users`: список, смена роли/статуса. Гарды «не себя» / «не последнего админа» enforce'ит бек и возвращает **409** (не 403) — обрабатывать |
| `audit` | `GET /api/admin/audit` | `/admin/audit`: просмотр с фильтрами (actor, target_type/id, action, даты) |
| `auth-register` | `POST /api/auth/register` | Расширение слайса `auth`: страница `/register`, self-service регистрация (бек выставляет её публично) |
| `glossary-enrichment` | `GET /api/glossary/{id}/revisions(+/{revisionID})`, `.md/.txt` ×4 | Расширение слайса `glossary`: ревизии терминов (через `revision-history`), ссылки на выгрузки. `POST /api/glossary/suggest` — волна 3 (lecture-enrichment) |
| `preferences-push` | `GET/PATCH /api/me/preferences`; `GET /api/push/vapid-key`; `POST/DELETE /api/push/subscribe`; `POST /api/admin/push/send` | Страница `/settings` (preferences + push-подписка); admin-рассылка `/admin/push`. **Foundation-touch:** `src/services/push-service` (сейчас заглушка: vapid из env, subscribe на бек не отправляется) и `src/hooks/use-push-subscription` — переподключение на `/api/push/*`; существующая `/push` заменяется redirect'ом на `/settings`; перед стартом выяснить происхождение незакоммиченного diff в `public/sw.js` |

### Волна 2 — контентное ядро

Порядок мержей внутри волны: `documents` → `annotations` (annotations встраивается в страницу документа follow-up-коммитом после мержа documents).

| Фича | API | UI-поверхности и примечания |
| --- | --- | --- |
| `comments` | `GET/POST /api/lectures/{id}/comments` (+.md/.txt), search, subtree (+.md/.txt), `PUT /api/comments/{id}/blocks`, `DELETE`, реакции, ревизии, `GET /api/comments/schema`, `GET /api/admin/comments` | Дерево на странице лекции; создание/редактирование через AST-редактор; **реакции пер-осевые** (agreement ±1, quality ±1, insight +1), допустимость осей зависит от типа комментария — матрицу брать из `GET /api/comments/schema`; поиск (требует auth); ревизии; admin-модерация **пер-лекционная** (`lecture_id` обязателен, глобального списка на беке нет); `GET /api/blocks/{block_id}` — резолв якорей для контекста |
| `documents` | `GET /api/documents` (picker), `POST /api/documents` и `/upload`, `GET/{id}` (+.md/.txt), `PATCH`, `DELETE`, `PUT …/blocks`, `PATCH …/visibility`, ревизии, attachments, `GET /api/me/documents`, `GET/DELETE /api/admin/documents…` | `/documents/my`; страница `/documents/[id]`; создание (JSON и upload); blocks-редактирование; видимость (private→public only); ревизии; список лекций-контейнеров; admin-список с delete_any (только public). **Владелец `src/components/attachments/`** (generic attach/detach/reorder UI; пикеры переиспользуют AsyncCombobox из `src/components/ast-editor/pickers/`) — мержится первым в волне 2 |
| `media` | `GET/POST /api/media`, `GET/{id}`, `DELETE`, `PATCH …/visibility`, attachments, `GET /api/me/media`, `GET /api/lectures/{id}/media` | `/media/my`; создание; просмотр; удаление; видимость. Admin-списка на беке **нет** — admin delete через обычный `DELETE` (для media `delete_any` действует независимо от видимости) |
| `annotations` | создание — **пер-сущностные роуты** `POST /api/{documents\|comments\|glossary\|media}/{id}/annotations` (в schema.ts задокументирован как generic `/api/entities/{type}/{id}/annotations` — см. §10); `GET/PUT/DELETE /api/annotations/{id}` (+.md/.txt), ревизии, `GET /api/me/annotations`, `GET /api/lectures/{id}/annotations`, `GET /api/admin/annotations` | Создание и просмотр на страницах document / glossary / media и на комментариях; на странице лекции — только агрегированный просмотр (на саму лекцию аннотация не создаётся); видимость фиксируется при создании; `/me/annotations`; ревизии; admin-список (public) с delete_any. Аннотации на banner/event UI не покрывает (§4) |

### Волна 3 — составные фичи

| Фича | API | UI-поверхности и примечания |
| --- | --- | --- |
| `forms` | `POST /api/forms`, `GET/PATCH/DELETE /api/forms/{id}`, submissions (`POST/GET /api/forms/{id}/submissions`, `GET/PATCH/DELETE /api/submissions/{id}`, `POST …/retract`), `GET /api/me/forms`, `GET /api/me/submissions`, `GET /api/admin/forms` | Конструктор форм; **видимость меняется полем `visibility` в PATCH-body** (отдельного эндпоинта нет), private→public only; publish-workflow (после — структура заморожена); заполнение (share-token позволяет отправить отклик в приватную форму — поддержать; GET формы аноним не видит даже public); отклики: editable — edit/delete (delete освобождает слот), immutable — только retract (сжигает слот навсегда, повтор → 409 `ALREADY_SUBMITTED`); владелец формы читает чужие отклики, но НЕ правит/удаляет; мои формы/отклики; admin-список с delete_any (public) |
| `trails` | `GET/POST /api/trails`, `/my`, `GET/PUT/DELETE /{id}`, `PUT …/items`, `PATCH …/visibility`, `GET /api/admin/trails` | Списки; страница трейла; CRUD; items (порядок); видимость; share-кнопка; admin-список с delete_any (public) |
| `share-links` | `GET/POST /api/share-links`, `DELETE /{token}`, admin `GET/DELETE /api/admin/share-links…` | Share-кнопка — компонент слайса `share-links`, компонуется страницами document/media/form/lecture/**trail** (slot-prop или рядом с detail), копий в других слайсах не делать; список своих ссылок; revoke; admin-модерация. **Consumption-flow:** Plan-агент сверяет shareTokenMW с беком и определяет viewer-роуты (`?token=` на страницах сущностей) — в schema.ts token-параметры есть не везде (§10) |
| `search` | `GET /api/search` (+ ссылка на `.md`) | Страница `/search`; точка входа в header (foundation-touch, там уже TODO под SearchInput) |
| `lecture-enrichment` | cover (`PUT/DELETE /api/lectures/{id}/cover`; URL обложки приходит в payload лекции), attachments (`POST/PATCH/DELETE /api/lectures/{lectureID}/attachments/…`), `GET /api/lectures/{id}/documents`, `…/media`, `…/tags`, `.md/.txt` лекций, `POST /api/glossary/suggest` | **Не новый слайс — расширение `src/features/lectures`.** Cover в admin-форме лекции; управление attachments через `src/components/attachments/` (гейты — §6.3; `entity_type=canvas` в списках рендерить graceful-плашкой); блоки документов/медиа на странице лекции — компоненты слайсов `documents`/`media` (фетчеры в их `api.ts`), компонует страница `src/app/lectures/[id]/page.tsx`; ссылки .md/.txt; подсветка glossary-терминов через suggest (nice-to-have, в конце волны) |

## 4. Вне скоупа

- **Canvas целиком**: фича canvases, визуальный редактор, canvas-picker (код остаётся в репо dormant), `canvas_ref` в ast-render (безопасный fallback уже есть).
- Аннотации на banner/event (бек позволяет, UI-поверхности для них нет — вернёмся при необходимости).
- Регенерация `src/api/schema.ts` (запретная зона; расхождения — §10).
- E2e- и скриншот-тесты (по конвенциям проекта не пишем).
- `.md`/`.txt`-выгрузки рендерит бек — фронт даёт только ссылки.
- `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/healthz`, `/readyz` — бек-поверхности, фронту не нужны.

## 5. Оркестрация

**Роли:**

- **Менеджер** (эта сессия): декомпозиция, запуск агентов, контроль мержей, отчёты. Кода не пишет.
- **Plan-агент** (на фичу): пишет план по skill writing-plans → `docs/superpowers/plans/2026-06-12-<feature>.md`, опираясь на эту спеку, конвенции и **бекенд-репозиторий** (не только schema.ts). Обязан: сверить имена capabilities с `internal/rbac/capabilities.go` бекенда и с уже используемыми в `src/app/admin/layout.tsx`; включить в план секцию **Parallel-safety contract** (списки create/modify/reserve файлов — по образцу планов 2a–2c).
- **Исполнители**: выполняют план в изолированном git worktree (skill subagent-driven-development / executing-plans).
- **Ревьюер**: code-review-субагент по диффу фичи перед мержем.

**Протокол мержа:**

1. Перед запуском исполнителей волны менеджер сверяет Parallel-safety contract'ы всех планов волны — пересечения по файлам запрещены (кроме `src/api/tags.ts`, см. ниже).
2. Фича готова в worktree, чеклист `_template/README.md` пройден.
3. `npm run lint && npm test && npm run build` — зелёные в worktree.
4. Code-review-субагент: замечания уровня bug / нарушение конвенций исправляются до мержа.
5. Менеджер мержит ветку в локальный `main` (push заблокирован — всё локально). Мержи строго последовательные. Конфликты резолвит **исполнитель вмерживаемой ветки** в своём worktree; после резолва — повторные lint/test/build и code-review диффа резолва.
6. `src/api/tags.ts` — append-only, ключи в алфавитном порядке: конфликты в нём тривиальны и резолвятся механически.

**Foundation-touch протокол:** запретные зоны фичи не трогают. Все касания батчируются в **один foundation-touch коммит (или серию) на волну**, выполняемый выделенным агентом после мержа фич волны. Инвентарь:

- Волна 1: admin-sidebar (tags, events, banners, audit), header (/calendar, /settings, /register?), root layout (banners), push-инфраструктура (`src/services/push-service`, `src/hooks/use-push-subscription`, при необходимости `public/sw.js`). users-admin и push-send в sidebar уже capability-gated — касание не нужно.
- Волна 2: admin-sidebar (documents; media — пункта не будет, admin-списка нет), header (/documents/my, /media/my); пункты comments/annotations уже в layout — **проверить имена capabilities** (`comment.moderate`/`annotation.moderate` в layout vs `comment.delete_any`/`annotation.delete_any` в RBAC бекенда — при расхождении исправить тут же).
- Волна 3: admin-sidebar (trails, forms, share-links), header (search — там TODO, /trails).

**Правила для каждого субагента (передаются в промпт дословно):** никаких `git stash/reset/checkout ./clean`; `git add` только своих файлов по имени; не откатывать чужие изменения; передавать эти правила своим субагентам.

## 6. Бизнес-правила бекенда (обязательны для всех планов)

1. **Видимость иммутабельна вниз**: public → private запрещён (422 `PUBLIC_IMMUTABLE`; lecture/document/media/trail/form/canvas). UI не предлагает даунгрейд — только private → public.
2. **Admin power split**: админ НЕ редактирует пользовательский контент — admin-edit форм не строить. Удаление: `*.delete_any` действует **только на public** для document/trail/annotation/form, но для **media и comments — независимо от видимости/периметра**.
3. **Attachments**: attach = `entity.attach` ∧ владение лекцией. `entity.attach` есть **только у роли user**, у админа нет → админ-владелец лекции attach не может (403), но detach/reorder может (гейт только ownership). UI: кнопка attach — `can(me, "entity.attach") && me.id === lecture.owner_id`; detach/reorder — только ownership. (Практическое следствие и вопрос к беку — §10.)
4. **Мутации лекции** (update, visibility, cover, attachments) — **owner-only без admin-override**; гейтить на `me.id === lecture.owner_id`, НЕ на роль/capability. Только create/delete/tags — через capabilities.
5. **Формы**: после publish структура заморожена (409 `FORM_PUBLISHED`); immutable→editable запрещён (409 `MODE_CHANGE_FORBIDDEN`); edit/delete immutable-отклика → 403 `FORM_IMMUTABLE_MODE`; retract существует только у immutable-форм (иначе 400 `RETRACT_NOT_APPLICABLE`), повторный retract → 409 `ALREADY_RETRACTED`, повторная отправка после retract → 409 `ALREADY_SUBMITTED`.
6. **Отклики**: читают только автор + владелец формы (без admin-override и share-token-чтения); правит/удаляет только автор; share-token позволяет **отправить** отклик.
7. **Comments не имеют собственной видимости** — наследуют периметр лекции.
8. **Видимость annotation фиксируется при создании** и не меняется.
9. **Suspended-пользователь** читает, но не пишет — обрабатывать 403 `SUSPENDED` понятным текстом.
10. **403 forbidden** → branded-текст «У вас нет прав на <действие>.»; 404 — secure-by-default. Гарды users-admin («не себя», «не последнего админа») возвращают **409**.
11. **409-семейство «на сущность ссылаются»**: `DOCUMENT_REFERENCED`, `LECTURE_REFERENCED`, `COMMENT_REFERENCED`, `GLOSSARY_REFERENCED`, `BLOCK_REFERENCED`, `BLOCKS_HAVE_ANCHORS`, `ALREADY_ATTACHED` — единый понятный UX.
12. **Реакции** — пер-осевые тогглы без подтверждений (POST upsert / DELETE оси); чужая ось → 422 `AXIS_NOT_ALLOWED`.
13. **Удаления аккаунтов нет** — только ban/suspend.
14. Комментариям в коде бекенда не верить без проверки кода (есть устаревшие, например про visibility у media).

## 7. Качество

- Чеклист `_template/README.md` обязателен для каждой фичи.
- Тесты обязательны: permissions (4+ кейса на каждый `can*`), schemas (success + failure на каждую Zod-схему).
- ESLint-гарды (изоляция слайсов) должны проходить без отключений правил.
- RBAC-паттерн: `requireCapability` в server actions, `canX()` в server components, boolean-пропсы в client; имена capabilities — строго из RBAC бекенда.
- Кеш: `React.cache` + `unstable_cache` с тегами, инвалидация через `revalidateEntity`.
- Переиспользуемый UI живёт в новых директориях `src/components/` (revision-history, attachments) или экспортируется слайсом-владельцем (share-кнопка); копирование между слайсами запрещено.

## 8. Отчётность

Полная автономия в пределах волны. После каждой волны — отчёт: что смержено, отклонения от спеки, риски, план следующей волны. Деструктивные действия и push не выполняются (push заблокирован в настройках).

## 9. Риски и митигейшены

- **Конфликты в shared-файлах** → Parallel-safety contract в каждом плане + сверка матрицы файлов до запуска + последовательные мержи + батчевый foundation-touch.
- **`public/sw.js` имеет незакоммиченный чужой diff** → не трогать; перед `preferences-push` выяснить происхождение и согласовать.
- **Большие фичи (forms, comments, documents)** → планы дробятся на этапы с отдельными коммитами; допускается разбивка на под-планы.
- **Дрейф schema.ts vs реальный бек** → уже материализовался (§10); при противоречии источник истины — бекенд; schema.ts не регенерировать, недостающие операции типизировать вручную в слайсе с комментарием-ссылкой на §10.
- **AST Phase 2b писался с canvas-picker** → Plan-агент фиксирует исключение canvas до старта выполнения.

## 10. Известные расхождения и вопросы к бекенду (эскалировано пользователю)

1. **Generic-роут аннотаций — фикция schema.ts**: `POST /api/entities/{type}/{id}/annotations` на сервере не зарегистрирован; реальные роуты — `POST /api/{documents|comments|glossary|banners|events|media}/{id}/annotations` (`cmd/server/main.go:1069-1081`). Фронт зовёт реальные пути (ручная типизация поверх generic-типов schema.ts).
2. **Пер-сущностные `GET /api/{entity}/{id}/annotations` отсутствуют в schema.ts**, хотя существуют на сервере — типизировать вручную при необходимости.
3. **Нет `GET /api/admin/media`** — модерация media возможна только с пользовательских страниц; дыра модерации на беке.
4. **Attach фактически недоступен**: лекции создают только админы (owner = админ), а `entity.attach` есть только у user → POST attach сейчас не может выполнить никто, кроме лекций, чей владелец сменил роль на user. UI строится по правилам бека (кнопка не покажется), но это кандидат на правку бекенда.
5. **Token-параметр share-links** объявлен в schema.ts не на всех GET-эндпоинтах, где shareTokenMW реально работает — plan-агент share-links сверяет с беком.
6. **`comment.moderate`/`annotation.moderate` в `src/app/admin/layout.tsx`** vs `comment.delete_any`/`annotation.delete_any` в RBAC бекенда — проверить и исправить в foundation-touch волны 2.

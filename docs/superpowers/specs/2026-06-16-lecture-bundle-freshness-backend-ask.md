# Backend-ask: дешёвый сигнал свежести бандла лекции (для офлайн-SWR)

**Дата:** 2026-06-16
**Кому:** `philosophy-api` (Go)
**Зачем фронту:** [SWR-ревалидация сохранённой офлайн-лекции](2026-06-15-offline-saved-status-revalidation-design.md) — узнать «устарела ли локальная копия» одним дешёвым запросом.
**Связано:** общий список — [2026-06-14-offline-backend-asks.md](2026-06-14-offline-backend-asks.md); рычаг (1) bundle / рычаг (2) ETag.

## Проблема (подтверждено по коду бэка)

Снимок сохранённой лекции (L1) включает **лекцию + документы + теги + комментарии**. Фронтовая фоновая сверка сейчас сравнивает только `lecture.updated_at` (ленивый вариант — за неимением другого сигнала). Но:

- **`lecture.updated_at` бампается ТОЛЬКО на прямой правке полей лекции** (title/description/date/visibility/cover): единственные `UPDATE lectures` — `internal/lecture/repo.go:146,158,206,230`.
- **Изменения потомков лекцию НЕ трогают:** attach/detach/reorder документов (`internal/attachment/repo.go`), контент документа (`internal/document/service.go:867` — `documents.version+1`), теги (`internal/tag/repo.go:89` SetLectureTags), комментарии (`internal/comment/*`) пишут только свои таблицы. Триггеров touch-parent нет (`migrations/001_init.sql` — только cascade-delete/visibility-guard).

⇒ Фронт **не может корректно** определить устаревание бандла. Изменил автор документ/комментарий/теги — читатель сохранённой копии об этом не узнает.

## Просьба (минимальный рычаг)

**Агрегатный strong-ETag на `GET /api/lectures/{id}` (JSON) + поддержка `If-None-Match` → `304`.**

Контракт для фронта (он уже описан в вашей же `docs/frontend/offline-saved-status.md`):

| Запрос | Ответ | Значение |
|--------|-------|----------|
| `GET /api/lectures/{id}` без `If-None-Match` | `200` + `ETag: "<bundleVersion>"` | как сейчас + заголовок |
| `GET …` с `If-None-Match: "<v>"`, бандл не изменился | `304` | копия свежа |
| `GET …` с `If-None-Match: "<v>"`, что-то в составе изменилось | `200` + новый `ETag` | копия устарела → FE покажет «доступна обновлённая версия» |
| лекция удалена | `404` (как сейчас) | FE помечает «удалена» |

**Ключевое требование к токену:** `ETag` должен меняться при ЛЮБОМ изменении состава снимка — самой лекции, её документов (контент + attach/detach/reorder), тегов, комментариев. Иначе сигнал снова слепнет к потомкам.

## Почему именно так (а не иначе)

- **Ложится на готовую optlock-инфру.** `version INTEGER`-конвенция, `WriteVersionETag`/`RequireIfMatchVersion` (`internal/httputil/etag_optlock.go`), паттерн `304` (`internal/httputil/httputil.go:244`, сейчас для `.md`/`.txt`-рендеров) — всё уже есть. Лекция всё равно в очереди на optlock-adoption (`docs/conventions/optimistic-locking.md:180`, `spec.md:31`) → один и тот же `version` лекции решит и `412` при записи, и `304` при валидации кеша.
- **Один дешёвый conditional GET** вместо 6 запросов фронтовой сборки на каждую сверку.
- **Совместимо с будущим bundle-эндпоинтом.** Если позже сделаете `GET /api/lectures/{id}/bundle` (рычаг 1, отдаёт весь состав одним ответом) — тот же агрегатный токен станет его ETag. То есть это не тупик, а первый шаг.

## Эскиз реализации на бэке (на ваше усмотрение)

1. Миграция в стиле 007/008: `ALTER TABLE lectures ADD COLUMN version INTEGER NOT NULL DEFAULT 1`.
2. На `GET /api/lectures/{id}` считать `bundleVersion` и отдавать `ETag: "<bundleVersion>"`; при совпадающем `If-None-Match` → `304` (переиспользовать существующий 304-путь).
3. **Агрегация состава.** У `documents`/`comments` `version` уже есть; у `lecture_tags`/`attachments` — нет. Два чистых пути:
   - *Производный токен:* `bundleVersion = lectures.version + Σ(documents.version) + Σ(comments.version) + сигнатура(lecture_tags, attachments)` (для двух последних — `COUNT`+`MAX(rowid)` или мини-инкремент только в attach/detach/reorder + SetLectureTags).
   - *Минимальный touch:* инкремент `lectures.version` только в 2 связочных операциях (attachment + tags), а правки контента документов/комментов отражать их собственным `version` в сумме. Узкая добавка вместо широкого touch из всех 4 слайсов.

**Не предлагаем:** (1) полагаться на `updated_at` — слеп к потомкам; (2) ETag рендера `.md` — его тело сейчас лишь title+description (`internal/lecture/handler_md.go:230`, «child documents out of scope for MVP») → сигнал ещё хуже; (3) широкий «touch parent `updated_at`» из всех 4 слайсов — ломает слоёвую изоляцию и SHARED-семантику `attachments` (документ висит на N лекциях).

## Фронт после выкатки (мелкая правка, не блокер сейчас)

- `probe-lecture-action` хранит `ETag` лекции в bundle (новое поле рядом с `remoteStatus`) и шлёт `If-None-Match`; `304` → fresh, `200` → stale.
- До тех пор остаётся **текущий ленивый probe** (`lecture.updated_at`): он корректно ловит изменения полей самой лекции и удаление (404), не ловит только вложенный контент — приемлемый interim (зафиксировано в спеке как known-limitation).

## Приоритет

Низкий/средний. Текущий interim деградирует мягко (best-effort, копия всегда доступна, ручной «Обновить» даёт полную свежесть по требованию). Рычаг ценен тем, что переиспользуется и для optlock-записи лекции, и для будущего bundle-эндпоинта.

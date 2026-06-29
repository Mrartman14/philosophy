# Форма как shared-content + результаты опроса — дизайн

Дата: 2026-06-29
Слайс: `src/features/forms`
Статус: одобрено к написанию плана.

## Контекст и мотивация

Бэк (`philosophy-api`, планы `2026-06-29-form-results-phase1/2/3`) превратил форму из
admin/owner-инструмента в **shared-content наравне с лекциями/документами/канвасом**:
форма теперь полноценный share-link ресурс (`sharelink.ResourceType` включает `"form"`),
а приватность управляется **двумя независимыми осями**:

- `form.visibility` (`private|public`) — доступ **к форме** (`CanSee(form)` = owner ∨
  прямой share-token ∨ (`public` ∧ authenticated); все маршруты `requiredAuth` — аноним
  не обслуживается даже с `?token=`).
- `form.submission_visibility` (`private|public`) — доступ **к результатам**. Дефолт
  `private` (two-party: автор отклика ∨ владелец формы). `public` = show-of-hands:
  атрибутированные голоса видны всему периметру формы.

Предикат результатов (бэк `canSeeFormResults`):
`автор ∨ владелец ∨ (submission_visibility=='public' ∧ CanSee(form))`. Отказ различает
существование: невидимая приватная форма → **404**, видимая форма с приватными
результатами → **403**.

**Конституционная рамка (определяет приватность UI).** Принцип 6 платформы:
«Высказывание неанонимно… анонимности на платформе нет — есть только приватность».
С7.1: «агрегатная аналитика по публично произведённому контенту легитимна без
отдельного согласия — согласие дано самим актом публикации». Поэтому результаты
**атрибутированы** (show-of-hands), не анонимны; приватность достигается осью
`submission_visibility`, а не анонимизацией. Бэк специально отдаёт `user:{id,username}`
в `FieldAnswerItem`. Согласие респондента раскрывается консент-текстом до submit'а
(§9.2 доков бэка).

На фронте сейчас формы поданы как owner/admin-инструмент: gateway `/forms/[id]`
(заполнение + owner-управление), owner-only `/forms/[id]/submissions`, `/me/forms`,
`/admin/forms`. **UI результатов отсутствует полностью.** Цель — привести подачу форм
к модели shared-content и добавить поверхность результатов.

## Read-контракт бэка (готов)

- `GET /api/forms/{id}` — форма (поддерживает `?token=`). `Form.submission_visibility`,
  `Form.owner: userref.Ref`.
- `GET /api/forms/{id}/stats` → `FormStats { total_submissions, fields: FieldStats[] }`;
  `FieldStats { field_id, type, answered, options: OptionStat[], number: NumberStats,
  date: DateStats }`; `OptionStat { option_id, label, count }`;
  `NumberStats { min, max, avg, sum }`; `DateStats { min, max }`. Периметр результатов,
  `?token=`.
- `GET /api/forms/{id}/fields/{fieldId}/answers` → `FieldAnswerItem[]
  { submission_id, submitted_at, user, value }`, пагинация (`offset/limit`), тот же
  периметр, `?token=`. `value: AnswerValue { text, number, date, option_id, option_ids }`.
- Агрегат и сырые ответы считаются по **живым (не retracted)** откликам.

**`submission_visibility` иммутабелен** (DB-триггер; отсутствует в `UpdateFormRequest` —
намеренно). Задаётся только при создании.

## Решения

- **Архитектура A — отдельные роуты** (не табы, не только-инлайн): каждая страница = одна
  задача, route-level гейтинг ложится на 404/403, зеркалит IA лекций/документов.
- **Атрибуция полная** (show-of-hands), без анонимизации (Принцип 6).
- **Индекс `/forms`** входит в спеку, но реализуется отдельной фазой — зависит от новой
  бэк-ручки (см. «Требования к бэку»).
- **Визуализация — CSS-бары без чарт-либы**, CSP-safe (см. §CSP).

## Карта страниц (IA)

| Роут | Статус | Назначение | Гейт |
|---|---|---|---|
| `/forms` | новый (ждёт бэк) | индекс публичных форм | authenticated; `GET /api/forms` |
| `/forms/new` | расширяем | создание + ось `submission_visibility` | `can(form.create)` |
| `/forms/[id]` | расширяем | role-adaptive gateway | `getFormById` (404 если не видна) |
| `/forms/[id]/results` | новый | агрегат-результаты | `canViewFormResults` |
| `/forms/[id]/fields/[fieldId]` | новый | полная колонка ответов поля (пагинация, атрибуция) | `canViewFormResults` |
| `/forms/[id]/submissions` | оставляем | управление откликами | owner-only |
| `/me/forms`, `/admin/forms` | оставляем | мои / модерация | как есть |

## Права (`forms/permissions.ts`)

Новый хелпер (единственная новая семантика):

```ts
/** Просмотр результатов формы — владелец ∨ публичные результаты.
 *  CanSee(form) уже гарантирован тем, что getFormById вернул объект (incl. ?token).
 *  Это ЧТЕНИЕ — без status-гейта: suspended-владелец сохраняет доступ к чтению. */
export function canViewFormResults(me: MaybeMe, form: Form): boolean {
  if (!me) return false;
  if (form.owner?.id === me.id) return true;
  return form.submission_visibility === "public";
}
```

На роутах `/results` и `/fields/[fieldId]`: `form == null → notFound()`;
`!canViewFormResults(me, form) → forbidden()` (из `next/navigation`). Токен из
`searchParams.token` пробрасывается во все чтения. Экспорт в `index.ts`.

## Gateway `/forms/[id]` (расширение [src/app/forms/[id]/page.tsx](../../../src/app/forms/[id]/page.tsx))

- **`FormVisibilityBadges`** (новый UI): бейджи `форма: private|public`,
  `результаты: private|public`, `режим: editable|immutable`. Read-only, информативные.
- **Вход «Результаты →»** при `canViewFormResults` → `/forms/[id]/results` (токен в href).
- **Консент-нотис в `FormFill`** при `submission_visibility==="public"`: до отправки
  показать «твой голос будет виден всем, кто видит эту форму». Для `private` — нет.
- После submit: существующий `FormAfterSubmit` + (если результаты видны) ссылка
  «посмотреть результаты».
- Существующее (share / publish / delete / edit / submissions-link / FormFill) — без
  изменений семантики.

## Результаты `/forms/[id]/results`

SSR-страница (хребет маргиналий ~720). Данные: `getFormById(id, token)` +
`getFormStats(id, token)`.

- Шапка: заголовок, `total_submissions` → «N откликов» (ICU-plural), `FormVisibilityBadges`.
- Карточки по полям **в порядке полей формы** (`form.fields`), диспетчер по `field.type`
  (новый `FieldStatsCard`):
  - **single_choice / multi_choice** → `ChoiceBars`: на опцию `label`, `count`,
    ширина бара = `count / answered`, процент. **База процента = `answered`** (не
    `total_submissions`). Для `multi_choice` подпись «возможно несколько вариантов»
    (сумма >100% допустима). Орфанные option_id недостижимы (форма иммутабельна) —
    «прочее»-бакет не рисуем.
  - **number** → `NumberSummary`: `min / max / avg / sum` + `answered`. Числа и avg —
    через i18n number-форматтер.
  - **date** → `DateSummary`: `min / max` + `answered` (через `getServerFmt`, формат
    чистой даты UTC).
  - **text / long_text** → `TextAnswersPreview`: `answered` + превью первых ~20
    атрибутированных ответов (`UserView` + `value.text` + дата) + ссылка
    «Все ответы →» на `/forms/[id]/fields/[fieldId]`.
- Пустое состояние: `total_submissions === 0` → «Пока нет откликов».

Эскиз компоновки:

```
Результаты — «Опрос N»            12 откликов
[форма: публичная] [результаты: публичные] [immutable]
─────────────────────────────────────────────
Q1 Ваш факультет?  (одиночный · 12 ответили)
  Философия    ███████████░░░░  7  58%
  История      ████░░░░░░░░░░░  3  25%
  Другое       ██░░░░░░░░░░░░░  2  17%
─────────────────────────────────────────────
Q3 Возраст  (число · 10 ответили)
  мин 19 · макс 64 · сред 31.4 · сумма 314
─────────────────────────────────────────────
Q4 Комментарий  (текст · 8 ответили)
  @ivan: «…»   2 июн
  @olga: «…»   2 июн               Все ответы →
```

## Колонка поля `/forms/[id]/fields/[fieldId]`

Полный пагинированный список ответов одного поля (`getFieldAnswers`, `offset/limit`
через `?p`). 1:1 с бэк-ручкой; атрибутировано (`UserView`). Для choice-полей —
drill-down «кто что выбрал»; для текстовых — все ответы. Тот же гейт
`canViewFormResults`, токен пробрасывается.

## Создание `/forms/new`

В `FormCreateForm` + `forms/schemas.ts` (Zod) добавить поле
**`submission_visibility` (`private|public`, дефолт `private`)** с пояснением:
«публичные результаты = атрибутированные голоса видны периметру формы; **после
создания изменить нельзя**». `CreateFormRequest.submission_visibility` уже в схеме.
Это единственное изменение авторинга; структуру/поля/режим не трогаем.

## Слой данных (`forms/api.ts`, `types.ts`, `index.ts`)

- `getFormStats(id, token?) → FormStats` (снимает `httputil.Response.data`).
- `getFieldAnswers(id, fieldId, token?, { offset, limit }) → { items: FieldAnswerItem[], total }`
  (снимает `ListResponse`).
- Хелпер `readAnswerValue(type, value)` — типобезопасное сужение `AnswerValue` по
  `FieldType` (text/long_text→`text`, number→`number`, date→`date`,
  single_choice→`option_id`, multi_choice→`option_ids`).
- Экспорт типов: `FormStats, FieldStats, OptionStat, NumberStats, DateStats,
  FieldAnswerItem, AnswerValue, SubmissionVisibility`.
- Кеш: per-form тег, инвалидация на submit/edit/delete/retract через `revalidateEntity`
  (как в остальных слайсах; per-юзерные данные не оборачивать в cross-request кеш).

## CSP

Под enforced-CSP `style-src-attr 'none'` (инициатива CSP hardening) **инлайн
`style={{width}}` для баров запрещён**. Ширины баров рисуем CSP-safe через
nonce'd `<style>`-блок (уже подключённый `CSPProvider` / `style-src-elem nonce`),
генерящий per-option правила ширины; альтернатива — SVG-геометрия (атрибуты, не CSS).
По умолчанию — nonce'd `<style>`. Никаких inline-style-атрибутов с динамикой.

## i18n

Новые ключи в неймспейсах `forms` и `pages` (заголовки секций, подписи типов полей,
«ответили», «возможно несколько вариантов», «N откликов» ICU-plural, консент-текст,
«Все ответы →», бейджи видимости). Плумбинг ar/zh как обычно (без перевода-носителем
в этой итерации).

## Тестирование

- Юнит: `canViewFormResults` (owner / public / private / token); `% = count/answered`;
  `multi_choice` сумма >100%; `readAnswerValue` по всем `FieldType`; формат числа/даты.
- Компонентные: `ChoiceBars` (бары, %, multi-нотис), `NumberSummary`, `DateSummary`,
  `TextAnswersPreview` (атрибуция отображается), консент-нотис появляется при
  `submission_visibility==="public"` и отсутствует при `private`.
- По `docs/frontend-conventions.md`; субагентов-имплементеров/ревьюеров — на Opus.

## Вне скоупа (YAGNI)

- Анонимизация результатов (Принцип 6).
- Тумблер `submission_visibility` после создания (иммутабелен на бэке).
- CSV-экспорт (нет бэк-ручки, не v1).
- Чарт-библиотека.
- Открытие `/forms/[id]/submissions`-списка периметру — его роль остаётся управлением
  владельца; периметр обслуживает `/results`.

## Требования к бэку (FE → BE)

1. **`GET /api/forms`** — список публичных форм: пагинация (`offset/limit`),
   `visibility=public`, опц. сортировка (новые/популярные) и `mine`-флаг. Сейчас есть
   только `POST /api/forms`. **Блокирует только фазу индекса `/forms`**; остальные фазы
   независимы.
2. (подтверждено, действий не требуется) `submission_visibility` иммутабелен и
   отсутствует в `UpdateFormRequest` — by design.

## Фазировка реализации

1. Данные + права + типы (`api.ts`, `permissions.ts`, `readAnswerValue`, экспорты).
2. `/forms/[id]/results` + `FieldStatsCard` + бары (CSP-safe) + number/date/text-сводки.
3. Gateway `/forms/[id]`: `FormVisibilityBadges` + консент-нотис + вход «Результаты →» +
   ссылка после submit.
4. `/forms/[id]/fields/[fieldId]` — колонка ответов поля (пагинация, drill-down).
5. `submission_visibility` в создании (`FormCreateForm` + Zod).
6. `/forms` индекс — **после** появления `GET /api/forms` + реген схемы.

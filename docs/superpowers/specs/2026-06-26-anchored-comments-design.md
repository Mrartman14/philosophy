# Комментарии к фрагменту текста (anchored comments) — дизайн

Дата: 2026-06-26
Статус: design approved, ожидает плана реализации

## Контекст и проблема

На странице лекции `/lectures/[id]` сейчас можно:
- оставить **аннотацию** к выделенному фрагменту текста (движок маргиналий
  `src/components/annotation-layer/`, домен `src/features/annotations/`,
  поле справа);
- оставить **комментарий**, но только в общий тред внизу страницы
  (`src/features/comments/`, `CommentSection`) — **без привязки к тексту**.

Бэкенд при этом уже умеет якорить комментарий к фрагменту: `comment.CreateRequest.anchor`
и `comment.Comment.anchor` опциональны (`src/api/schema.ts`, `comment.Anchor` —
строка 16754). Фронт read-путь уже частично готов (`comment-anchor-context.tsx`
рендерит контекст якоря), но **write-путь отсутствует**: форма создания не
захватывает выделение и не шлёт `anchor`.

Цель — дать пользователю комментировать конкретный кусок текста так же удобно,
как он это делает с аннотацией, переиспользуя зрелый движок аннотаций.

### Разница моделей anchor (подтверждено по бэкенду)

Это **осознанное** архитектурное решение бэкенда (`philosophy-api`), не недочёт:

- `annotation.Anchor` (`internal/annotation/model.go:56`) — только координаты
  (`anchor.Position`). Цель задаётся отдельными полями `ParentEntityType/ID` на
  самой `Annotation`. Anchor всегда указывает на родителя — *дом = цель*.
- `comment.Anchor` (`internal/comment/model.go:136`) — координаты **плюс
  обязательные** `target_entity_type` (`document|glossary|comment|media`) +
  `target_entity_id`. Комментарий всегда висит на `lecture_id` (*дом*-лекция,
  link), а anchor дополнительно указывает на фрагмент под-сущности лекции
  (*цель*, anchor). У комментария *дом ≠ цель*, поэтому target живёт внутри anchor.

Общий доменный примитив координат — `anchor.Position` (`internal/anchor/position.go`),
domain-agnostic, используется обеими фичами. См. `philosophy-api/docs/domain/anchors.md`.

## Принятые решения (из брейншторма)

1. **Модель данных:** `anchor` — опциональное свойство ЛЮБОГО комментария.
   Заякоренные и незаякоренные комментарии живут в ОДНОМ треде внизу
   (`CommentSection`). Заякоренные дополнительно: подсвечивают текст и дают
   превью-карточку в левом поле. Одна сущность, один тред, одна форма с
   опциональным anchor. Совпадает с контрактом бэка.
2. **Read-интеракция:** клик по подсвеченному фрагменту → в левом поле всплывает
   карточка-превью **корневого** комментария фрагмента (автор, тип, тело,
   счётчик ответов) + кнопка «Открыть тред» → скролл к этому комментарию в
   нижнем `CommentSection` + подсветка там. Поле = лёгкое превью; вся
   дискуссия/ответы/реакции — внизу, где есть место. Нижний тред переиспользуется
   как есть.
3. **Подсветка комментариев — не постоянная** (чтобы не конкурировать с
   аннотациями за внимание): проявляется по `hover` над прокомментированным
   фрагментом ИЛИ по глобальному тоглу «Показать комментарии в тексте». Отдельный
   визуальный канал `::highlight(comment)` (цвет/подчёркивание отличны от аннотаций).
4. **Scope v1:** якорь только на инлайн-документ лекции
   (`target_entity_type="document"`, `target_entity_id = activeDoc.id`).
   Архитектуру слоя закладываем с учётом мульти-таргета на будущее, но реализуем
   только document.
5. **Узкие экраны (<1280px):** левое поле схлопывается в поток; клик по фрагменту
   сразу скроллит к треду внизу (карточка-превью пропускается).
6. **Сосуществование с аннотациями:** разные `::highlight` каналы; аннотации —
   eager/справа/always-on, комментарии — lazy/слева/hover-or-toggle. При редком
   точном наложении клик приоритетно открывает комментарий слева, аннотация
   остаётся видна справа. Код аннотаций по поведению не меняется.

## Не делаем в v1 (YAGNI)

- Якоря на glossary / media / другой комментарий (бэк умеет — отложено).
- Ответы/реакции прямо из левого поля (всё внизу в треде).
- Полноценная eager-лента комментариев в поле (как у аннотаций).
- Мобильный inline-popover у выделения.

## Архитектура (подход C: нейтральное ядро + миграция обеих фич)

Движок `src/components/annotation-layer/` уже на ~90% доменно-агностичен. Делаем
его честным общим ядром и ставим на него ОБЕ фичи. Внешний импорт-сёрфейс мал:
из движка наружу импортирует только `features/annotations` (3 точки:
`anchor.ts`, `ui/document-annotation-layer.tsx`, реэкспорт коннектора в
`ui/document-annotations.tsx`). Публичный `index.ts` отдаёт лишь `AnnotationLayer`
+ 3 типа. Поэтому C — это аккуратный rename + вынос glue в хуки, а не переписывание.

### Ярус 1 — `src/components/anchor-engine/` (нейтральное ядро)

Переименование из `annotation-layer/`, доменно- и политика-агностично.

- **Pure-примитивы (переезжают как есть, с тестами):** `types`
  (`TextAnchor`/`AnchoredNote`/`AnchorDraft`), `use-selection-capture`,
  `anchor-from-selection`, `anchor-to-range`, `dom-text`, `hit-test`, `stacking`,
  `highlight-controller` (канал по конструктору `name`), `highlight-overlay`,
  `selection-affordance`, `margin-notes-column`, `css-escape`, `test-support`.
- **Извлечённые shared-хуки** (вынимаются из нынешнего `annotation-layer.tsx`,
  чтобы обе политики не дублировали glue):
  - `useAnchorRanges` — `notes → Map<id, Range>`, пересчёт на resize/fonts/ready.
  - `useAnchorHighlights` — `controller.apply(set)` + `controller.setActive(range)`
    по заданному каналу.
  - `useAnchorInteraction` — клик по тексту → hit-test → active → скролл к цели;
    обратный скролл (цель → текст).
- **Новое, аддитивное (только для комментариев):** `useHoverReveal` —
  `mousemove` (throttle) → `hit-test` → `setActive` подсвечивает фрагмент под
  курсором. Аннотаций не касается.

### Ярус 2 — две тонкие политики-компоненты в ядре

Знают про *режим рендера/подсветки/сторону*, НЕ про домен.

- `MarginAnchorLayer` — eager-рендер карточек в поле, подсветка always-on,
  пропы `side` (`"start" | "end"`) и `highlightMode`. Обобщение нынешнего
  `AnnotationLayer`. **Аннотации мигрируют на него** (`side="end"`), поведение
  байт-в-байт прежнее.
- `InlineAnchorLayer` — lazy-рендер (карточка по клику) + hover-reveal, проп
  `side`. Под комментарии (`side="start"`). На узком экране клик не открывает
  карточку, а вызывает переданный `onActivate(id)` (коннектор скроллит к треду).

### Ярус 3 — доменные коннекторы в фичах

Anchor-конверсия с инъекцией target, fetch, RBAC, формы.

- `features/annotations/ui/document-annotation-layer.tsx` → `MarginAnchorLayer`
  (правка импорта, без смены поведения).
- `features/comments/ui/document-comment-layer.tsx` (новый) → `InlineAnchorLayer`.

### Общие утилиты (выносятся, делятся обеими фичами)

- Координатная конверсия `apiAnchor ↔ TextAnchor` — сейчас в
  `features/annotations/anchor.ts` (`toEngineAnchor`/`fromEngineAnchor`). Выносим
  координатную часть в общий util; target-поля каждая фича добавляет сама
  (аннотации — никаких; комментарии — `target_entity_type/id`).
- Form-хелперы `makeAnchorJsonSchema` / `makeBlocksJsonSchema` — из
  `features/annotations/schemas.ts` в общий слой; комментарии переиспользуют.

## Write-путь (создание заякоренного комментария)

1. Выделение текста внутри `[data-ast-root]` (инлайн-документ лекции) →
   `useSelectionCapture` → `SelectionAffordance` c label «Комментировать».
2. Клик → диалог-композер (зеркало `AnnotationComposerDialog`): цитата `exact`
   как контекст + селектор `type` (claim/grounds/…) + AST-редактор тела
   (`entityContext="comment"`).
3. Submit → `createComment` с `anchor`. Коннектор доинжектит
   `target_entity_type="document"`, `target_entity_id = activeDoc.id`, координаты
   из `fromEngineAnchor`.
4. Новый комментарий появляется в нижнем треде; его подсветка становится доступной.
5. Нижняя форма «обычного» (незаякоренного) комментария остаётся без изменений.

Правки: `features/comments/schemas.ts` (+`anchor` через общий
`makeAnchorJsonSchema`), форма создания (+hidden `anchor`), `actions.ts`
(+`anchor` в тело запроса). RBAC — текущий `canCreateComment`, без изменений.

## Read-путь (просмотр)

`document-comment-layer.tsx` получает заякоренные комментарии текущего документа
(фильтр `anchor?.target_entity_type === "document" && target_entity_id === activeDoc.id`),
маппит anchor → `TextAnchor` через общий конвертер.

- Подсветка по умолчанию пустая: `useAnchorHighlights` с каналом `"comment"`,
  `apply([])`. Hover: `useHoverReveal` → `setActive(range)` подсвечивает фрагмент
  под курсором. Глобальный тогл «Показать комментарии» → `apply(all ranges)`
  (persistent, как у аннотаций; состояние в localStorage, отдельный ключ).
- Клик по подсвеченному фрагменту → `hit-test` → широкий экран: рендер
  карточки-превью корневого комментария в `MarginNote side="start"`, позиция по Y
  от rect якоря (одиночный `stacking`); + кнопка «Открыть тред» → скролл к
  комментарию в нижнем `CommentSection` + подсветка там.
- Узкий экран (<1280px): клик → сразу скролл к треду внизу (превью пропускается).

## Разводка в странице лекции

`src/app/lectures/[id]/page.tsx`: добавить левый `MarginNote side="start"` с
`DocumentCommentLayer parentLectureId={id} documentId={activeId}` (по аналогии с
правым `MarginNote side="end"` для аннотаций). Тогл «Показать комментарии» — рядом
с тоглом подсветки аннотаций. На `/documents/[id]` левое поле занято TOC —
комментарии там не вводим (они привязаны к лекции).

## Данные / контракт

- `comment.CreateRequest.anchor` (опц.) и `comment.Comment.anchor` уже есть — нужно
  начать слать/читать. Координаты — UTF-16 (`anchor.Position`, общий примитив).
- Read для v1 — из существующего `getLectureComments` + клиентский фильтр по
  target. Если тред станет большим — отдельный бэк-аск на серверный фильтр
  «заякоренные на документ X»; для v1 клиентского фильтра достаточно.

### Бэк-аск cross-lecture validation — ЗАКРЫТ на бэке (2026-06-26)

Бэк подтвердил: проверки не было, репорт верный (не намеренно). **Закрыто на корне.**
Модельное уточнение: документы/медиа — standalone и прикрепляются к N лекциям,
поэтому инвариант — не «принадлежит лекции», а **«достижима внутри лекции
комментария»** (реверс-периметр composition). По типам цели:
- `document`/`media` — цель обязана быть прикреплена к `lecture_id` комментария;
- `comment` — `lecture_id` целевого == `lecture_id` нового;
- `glossary` — глобальный, проверка неприменима.

Новый код **`ANCHOR_TARGET_WRONG_LECTURE` (422)**. Заодно доведены до enum
`ANCHOR_ENTITY_UNKNOWN` / `ANCHOR_BLOCK_NOT_FOUND` / `ANCHOR_TARGET_NOT_FOUND` —
всё anchor-семейство кодов теперь типизировано. Существующие проверки
(block/media existence) идут раньше: несуществующая цель → `ANCHOR_BLOCK_NOT_FOUND`
/ `ANCHOR_TARGET_NOT_FOUND`, «существует, но в чужой лекции» →
`ANCHOR_TARGET_WRONG_LECTURE`. **Наш путь (якорь на инлайн-документ текущей
лекции) не затронут.**

**FE-realign (follow-up, координированно):** FE `schema.ts` пока содержит только
`ANCHOR_INVALID` — нужна **регенерация схемы**, чтобы подтянуть новые коды (тогда
их можно типобезопасно добавить в `ERRORS`-map комментариев + сообщения в
`errors`-каталог). Не блокер v1 (happy-path не триггерит эти коды); реалистично
лишь text-drift между выделением и сабмитом → `ANCHOR_BLOCK_NOT_FOUND`.

### Открытый бэк-аск (остаётся)

**Инвариант anchor-only-on-root.** Бэк допускает `anchor` на любом `comment`
(включая ответы). v1 read-путь (`selectAnchoredRoots`) берёт только корни —
заякоренные ответы не подсветятся. Гарантирует ли бэк инвариант «anchor только
на корне», или FE должен обрабатывать `descendants[].anchor`?

## Секвенирование (де-риск)

**PR1 — foundation (рефактор, без новой фичи).**
Создать `anchor-engine/`: rename + вынос shared-хуков + обобщение eager-оркестратора
до `MarginAnchorLayer(side, highlightMode)`; добавить `useHoverReveal` + каркас
`InlineAnchorLayer`. Вынести координатный конвертер и form-хелперы в общий слой.
Мигрировать аннотации на `MarginAnchorLayer`. Тест-сьют движка переезжает и
остаётся зелёным. **Гарантия: поведение аннотаций идентично.** Гейт
`pnpm lint && pnpm test && pnpm build` + обязательная ручная браузер-QA аннотаций
ДО старта PR2.

**PR2 — feature (комментарии).**
Коннектор `document-comment-layer.tsx` на `InlineAnchorLayer`; расширение
формы/схемы/экшена `createComment` опциональным `anchor` (+инъекция target);
разводка в странице лекции (левый `MarginNote` + тогл); тесты + браузер-QA.

## Тестирование (TDD)

- Юнит: маппинг note→engine; инъекция `target_entity_type/id`; парсинг `anchor`
  JSON в схеме создания; hit-test выбора note; клиентский фильтр «только document
  текущего дока»; поведение `InlineAnchorLayer` на узком экране (вызов
  `onActivate` вместо карточки).
- Переезд существующих тестов движка (anchor↔range, stacking, hit-test,
  highlight-controller, margin-notes-column, selection-capture) — остаются
  зелёными как контракт behavior-preservation для аннотаций.
- jsdom не рендерит CSS Custom Highlight / `getClientRects` → подсветку и
  абсолютное позиционирование выносим в ручную браузер-QA (как и у аннотаций).

## Риски и митигейшн

- **Регрессия аннотаций** при рефакторе движка (UTF-16 offsets, stacking,
  highlight). → Behavior-preserving рефактор; тесты переезжают вместе; браузер-QA
  аннотаций — гейт перед PR2.
- **Rename-churn** — механический, 3 внешние точки; deep-import ESLint-гарды
  закрываем полным реэкспортом из нового `index.ts`.
- **`::highlight(comment)` в `globals.css`** — foundation shell-файл; правка
  строго аддитивная (только добавление правил).
- **Конкуренция подсветок** аннотация/комментарий на одном тексте → разные каналы
  + разный визуал + приоритет клика на комментарий.

## Запретные зоны / координация (AGENTS.md)

- `src/components/anchor-engine/` (бывш. `annotation-layer/`) — общая
  инфраструктура; PR1 трогает её отдельно и аккуратно.
- `src/app/globals.css` — root shell; только аддитивные `::highlight(comment)` правила.
- `src/api/schema.ts` — НЕ трогаем (контракт `comment.Anchor` уже есть).
- Параллельные агенты: добавлять только свои файлы по имени, без `git add -A`,
  без деструктивных git-операций.

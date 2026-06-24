# Аннотации к выделенному тексту — движок маргиналий (Word-style)

- **Дата:** 2026-06-24
- **Статус:** Draft v2 (ревизия после адверсариального ревью + фиксов бэкенда)
- **Версии:** v1 — исходный дизайн; v2 — учтены 6-осевое адверсариальное ревью и обновление `src/api/schema.ts` бэкендом.

## 1. Цель

На странице просмотра документа пользователь выделяет фрагмент текста → у выделения
всплывает кнопка «+ Аннотация» → по клику открывается **модалка** ввода → при сохранении
заметка, привязанная к этому фрагменту, появляется в **боковой панели справа**, на одной
высоте с текстом, к которому относится. Визуально — как комментарии в Microsoft Word:
подсветка фрагмента в тексте + карточка-заметка на полях, связанные двусторонне.

### Ключевое нефункциональное требование

Функционал привязки заметок к тексту будет **переиспользоваться** (глоссарий, комментарии,
транскрипты медиа). Ядро проектируется как **изолированный, оттестированный «движок»**,
инжектируемый на поверхность просмотра, доменно-агностичный. Аналог общей базы
`src/components/scene-3d/` для карты и графа.

## 2. Зафиксированные решения (v2)

| Развилка | Решение |
| --- | --- |
| Ввод заметки | **Модалка** (`Dialog` kit) с **урезанным AST-редактором** (`entityContext="annotation"`), НЕ plain-text. Урезание диктует бэк через `/api/ast/schema` (level `annotation`). |
| Видимость | **Выбор private/public**, дефолт private |
| Сторона панели | **Справа** (логическое `end`, RTL-зеркалится); <1280px — список снизу |
| Подсветка | CSS Custom Highlight API + **обязательный** оверлей-фолбэк (см. §4.4); отключаемая (reading-mode) |
| Платформы/a11y v1 | **Тач + клавиатура** обязательны: захват через `selectionchange` + `pointerup`/`touchend`, фокус-достижимый аффорданс |
| Двусторонний клик | **В v1, отдельной задачей**: клик по подсветке ↔ клик по карточке (хит-тест + `setActive` + скролл с reduced-motion) |
| Reading-mode | Локальный тумблер (`localStorage`); движок агностичен к источнику флага |
| Имя движка | `src/components/annotation-layer/` |
| Токен подсветки | Новый foundation-токен `--color-highlight` (+ APCA-пара в CI-гард), НЕ переиспользование `--color-accent` |
| Офлайн / media | Вне scope v1 |

## 3. Архитектура: движок (foundation) ↔ обвязка (фича)

**Граница выстояла в ревью.** Фича зависит от движка; движок не знает о фиче (без
cross-feature, без upward-coupling). Движок — `"use client"` foundation в `src/components/`,
не импортирует ни одну `src/features/*`.

**Агностичен к сущности, но привязан к AST-субстрату (hard-precondition).** Движок не знает,
аннотируем мы document/glossary/comment/media, — но работает ИСКЛЮЧИТЕЛЬНО на DOM,
отрендеренном из AST (`ast-render`): anchor оперирует `block_id` + UTF-16-офсетами внутри
текста блока, чего на произвольном HTML нет, и чего ждёт бэк. Это не «универсальный
текст-аннотатор». Принуждение — структурное (см. §7.1): generic-HTML путь не выражается ни
в типах (`TextAnchor` только блочный), ни в рантайме (аффорданс не появляется вне AST-блоков).

```
┌─ src/features/annotations/ (обвязка) ─────────────────────────┐
│  SSR-сбор карточек (общий билдер) · createAnnotation(anchor)   │
│  RBAC-булевы · урезанная AST-модалка · renderNote(card)       │
│         │ данные + колбэки вниз                                │
│         ▼                                                      │
├─ src/components/annotation-layer/ (движок, доменно-агностичен) ┤
│  React: <AnnotationLayer> <SelectionAffordance>               │
│         <MarginNotesColumn> <HighlightOverlay?>               │
│  Ядро: anchor-from-selection · anchor-to-range · stacking ·   │
│        highlight-controller · hit-test                        │
└───────────────────────────────────────────────────────────────┘
            │ DOM-контракт (data-block-id) + общий референс-контейнер
            ▼
   src/components/ast-render/
```

### 3.1. Доменно-агностичные типы движка

```ts
// src/components/annotation-layer/types.ts
export interface TextAnchor {
  startBlockId: string; endBlockId: string;
  startChar: number; endChar: number;   // UTF-16 code units (контракт бэка)
  exact: string; prefix?: string; suffix?: string;
}
export interface AnchoredNote { id: string; anchor: TextAnchor }
export interface AnchorDraft { anchor: TextAnchor; rect: DOMRect }
```

Фича маппит `annotation.Anchor` ↔ `TextAnchor` (поля идентичны; единицы совпадают — UTF-16).

## 4. Чистое ядро движка (юнит-тестируемо на jsdom)

### 4.1. `anchor-from-selection.ts`
`Selection`/`Range` + контент-рут → `TextAnchor | null`. Находит ближайший
`closest('[data-block-id]')`; считает **plaintext-офсет в UTF-16** (`String.length` /
`node.textContent.length` — единицы совпадают с контрактом бэка, конверсия НЕ нужна).
`exact`=выделенный plaintext; `prefix`/`suffix`=±32 символа контекста.
**`<br>` (hard_break)** учитывается как `"\n"` при обходе (иначе офсеты после переноса
разойдутся). `null` вне блоков/при collapsed.

### 4.2. `anchor-to-range.ts`
`TextAnchor` + root → `Range | null`. **Первично** по `block_id`+`char`. **Фолбэк по
цитате (исправлен):** ищем `prefix+exact+suffix`, получаем глобальный офсет вхождения,
**вырезаем `exact` ВНУТРИ найденного контекста** (`[off+prefix.len, off+prefix.len+exact.len]`)
— не ищем голый `exact` заново (это был баг v1: терялась дизамбигуация дубликатов). Перебор
вхождений через `indexOf(needle, from)`. `null` = сирота. **`CSS.escape` — через guard-хелпер**
(в jsdom глобального `CSS` нет → иначе TypeError).

### 4.3. `stacking.ts`
`Array<{id,top,height}>` → `Map<id,top>` непересекающихся позиций, порядок по `top`. Чистая.
Также экспонирует итоговую суммарную высоту (для min-height-распорки колонки).

### 4.4. `highlight-controller.ts` + ОБЯЗАТЕЛЬНЫЙ оверлей-фолбэк
Подсветка `Range[]`:
- **Основной путь:** CSS Custom Highlight API (`CSS.highlights.set("annotation", …)`), ноль
  мутаций DOM. `setActive(range)` — отдельный слой `annotation-active`, отличающийся **вторым
  визуальным каналом** (underline/outline через `::highlight()`), а не только альфой — иначе
  active неотличим от перекрытия.
- **Фолбэк (реализуется в v1, не «опционально»):** при отсутствии `CSS.highlights` —
  оверлей-`<div>` из `range.getClientRects()` в абсолютном слое, репозиция на resize/scroll/fonts.
  Ценность фичи («видеть подсветку») явно требовалась пользователем → молчаливая деградация
  без подсветки недопустима на части браузеров (старый iOS-Safari/Firefox).
- **Перекрытия аннотаций — известное ограничение v1:** все диапазоны в одном highlight красятся
  плоским объединением, границы отдельных заметок не видны. Зафиксировано (§13). Дизамбигуация
  при клике — через хит-тест (§5.4).

### 4.5. `hit-test.ts` (для двустороннего клика)
Точка клика (x,y) в контент-руте → `noteId | null`: `document.caretRangeFromPoint`/
`caretPositionFromPoint` → проверка, какой из note-`Range` накрывает позицию. Чистая (given DOM).

## 5. React-слой движка

### 5.1. Захват выделения (тач + клавиатура)
Источник — **`selectionchange`** (дебаунс ~250мс) как первичный + `pointerup`/`touchend` как
«выделение завершено». НЕ только `mouseup` (это desktop-mouse-only — провал v1-требования).
`selectionchange` автоматически покрывает и клавиатурное выделение (Shift+стрелки). Guard на
программное снятие (`removeAllRanges` сам диспатчит `selectionchange`).

### 5.2. Доступный аффорданс создания
- **Координатный тултип** (`<SelectionAffordance>`, портал) — визуальное усиление для мыши/тача,
  у выделения. Позиционируется от `selection.getRangeAt(0).getBoundingClientRect()`. Прячется на
  scroll/resize/снятии выделения.
- **Фокус-достижимая кнопка** «Аннотировать выделение» в шапке колонки, активна при непустом
  выделении в контент-руте — клавиатурный путь (тултип по координатам Tab-ом недостижим).
- `aria-live="polite"` анонс появления; `aria-label` с цитатой фрагмента.

### 5.3. Позиционирование карточек (РЕДИЗАЙН — был блокер v1)
v1-схема (`anchorTop = rect.top + scrollY − 0`) была геометрически сломана: измерение в
координатах документа, применение — в offset-родителе другой колонки → постоянный сдвиг `Y_col`.

**v2-схема:** измерять Y якоря **относительно контейнера колонки** (общий референс):
`topCSS = textRect.top − columnRect.top` (оба `getBoundingClientRect()` в одной вьюпорт-системе;
`scrollY`/header сокращаются). Измерение живёт **внутри** `MarginNotesColumn` (где есть ref на
`relative`-контейнер), либо `columnRef` пробрасывается в движок.
- **Реактивность:** `ResizeObserver` на контент-рут И колонку + слушатели `resize` +
  `document.fonts.ready` + `load` картинок → пересчёт. Без этого смена оси шрифта/плотности
  (appearance) или догрузка картинок ломают привязку.
- **Narrow-гард:** `matchMedia("(min-width: 80rem)")` — на узких НЕ применять абсолют (чистый
  поток-список), иначе абсолютные `top` дают мусор в схлопнутой колонке.
- **Распорка:** `min-height` контейнера = суммарная высота стека (из `stacking`), иначе
  абсолютные карточки схлопывают контейнер в 0 и наезжают на соседний контент.
- Подсветка (CSS Highlight / оверлей) и карточки репозиционируются от **одного** источника
  геометрии → не расходятся.

### 5.4. Двусторонний клик (отдельная задача v1)
- Клик по контент-руту → `hit-test` → `noteId` → `setActive` + скролл карточки.
- Клик по карточке → `setActive(range)` + скролл фрагмента. Скролл — `behavior` зависит от
  `useReducedMotion()` (ось motion=reduced глушит smooth). «Вспышка» — не CSS-keyframes (их
  убьёт motion-гард на `*` и `::highlight` им не подвластен), а таймерный свап active-слоя; при
  reduced — статичная подсветка без мигания.

## 6. Обвязка фичи `src/features/annotations/`

### 6.1. Урезанный AST-ввод (подтверждено по коду)
Модалка = `Dialog` + существующая `AnnotationCreateForm` с `entityContext="annotation"` (уже
так). Урезание набора блоков диктует бэк через `/api/ast/schema` (level `annotation`); FE ничего
не хардкодит. Контекст уходит бэку **через сам роут** `/api/{entity}/{id}/annotations` — бэк
применяет `ast.ValidateForContext` для аннотаций. Отдельного поля профиля в `CreateRequest` нет
и не требуется. Форма монтируется внутри `SchemaContextProvider` с серверно-гидрированной схемой.
Добавляем: приём `anchor` пропом + скрытое поле; колбэк `onSuccess`/`onClose` (закрыть модалку).

### 6.2. SSR-фолбэк (ИСПРАВЛЕН — был баг v1)
v1 прятал якорённые карточки за `mounted` → их не было в SSR/no-JS HTML (противоречие §6.3, удар
по SEO/a11y). **v2:** server-компонент рендерит ВСЕ карточки (anchored+unanchored) обычным
списком — это zero-JS/узко-экранный/индексируемый базис. Клиент **только улучшает** существующие
узлы (позиционирует + подсвечивает), а НЕ создаёт контент. `mounted` управляет лишь
позиционированием/подсветкой, не существованием карточек.

### 6.3. Общий сборщик карточек (DRY)
Логика сбора карточек (RBAC + schema + `AnnotationCard` с действиями) выносится в общий
server-хелпер, потребляемый и `AnnotationsSection` (list-режим glossary/media), и
`DocumentAnnotations` (margin-режим). Не клонировать (v1 дублировал).

### 6.4. Поток после создания
`createAnnotation` → `revalidateEntity` + форма закрывает модалку (`onClose`) и вызывает
`router.refresh()` (server-снимок карточек обновляется только через refetch родителя; одного
`revalidateEntity` мало). Документируется как требование.

### 6.5. Discovery контент-рута (укреплён)
Вместо глобального `querySelector('[data-annotation-content]')` + гонки `useMemo` по стабильному
ref — обернуть контент-рут клиентской обёрткой с **реальным React-ref** и пробросить его (или
через контекст). Пересчёт подсветки/позиций завязать на `mounted`/ref-готовность.

### 6.6. Reading-mode тумблер
Кнопка в шапке колонки прячет подсветку (и опц. колонку). `localStorage`, дефолт on.

### 6.7. Семантика для AT
Аннотированность текста для скринридера живёт НЕ в CSS-подсветке (чистый пиксель), а в
**SSR-списке карточек + цитата** (`AnnotationAnchorContext` показывает prefix/exact/suffix).
Зафиксировано как a11y-канал v1; опц. `aria-details` от обёртки фрагмента к карточке — follow-up.

## 7. DOM-контракт (foundation-касание)

`data-block-id={block.id}` на блоках, несущих текст: paragraph/heading/list_item/blockquote/
code_block (и вложенные). **НЕ ставить на `<table>`** (ячейки без id → `closest` поднялся бы до
таблицы и дал мусорный якорь по всему textContent; лучше честный `null`). **`<image>` — не менять
DOM-структуру** (без обёрток). Контракт: «контент-рут содержит элементы с `data-block-id`; текст
блока = конкатенация его текстовых узлов (+`\n` за `<br>`)». Касание `src/components/ast-render/`
— foundation, аддитивно, флагуется. `block_id` — глобально уникальный UUID (`anchors.md`), т.е.
у блоков стабильные id; FE-проверка лишь в том, отдаёт ли GET-payload `id` у ВЛОЖЕННЫХ блоков
(`content[].id`). Если часть без id — анкоринг ограничен блоками с id.

### 7.1. AST-субстрат — форсированное принуждение

Движок аннотирует ТОЛЬКО AST-рендер, не произвольный HTML (бэк ждёт `block_id`+UTF-16-офсет).
Принуждение делается на трёх уровнях, чтобы не было «тихого» или мусорного поведения:

1. **Структурный маркер.** `data-ast-root` ставит **консьюмер** на обёртку контента (page-level
   `<div data-ast-root>` вокруг `DocumentDetail`), т.к. `AstRender` рендерит фрагмент без обёртки
   (flow-контракт `.content`; обёртка ломает вертикальный ритм). Движок принимает `astRootRef`,
   указывающий на `[data-ast-root]`, и ищет `[data-block-id]` внутри; `ast-render` не трогается.
2. **Захват скоупится в AST-рут (двойной гейт).** (а) Хук захвата `use-selection-capture`
   ПЕРВЫМ делом отбрасывает выделение, чей `anchorNode`/`focusNode` не внутри `astRootRef`
   (`root.contains(...)`) — `selectionchange`/`pointerup` вне AST-контента даже не обрабатываются.
   (б) `anchorFromRange` дополнительно требует, чтобы и start, и end резолвились в
   `closest('[data-block-id]')` с непустым id внутри рута. Выделение, начавшееся в AST и ушедшее
   в карточку/сайдбар/не-AST → `null`. Аффорданс «+ Аннотация» показывается лишь при не-`null`
   якоре → кнопка физически не появляется на не-AST тексте (устрожение-рамка, не «тихий отказ»).
3. **Типовой уровень.** `TextAnchor` — только блочный (`startBlockId`/`startChar`/…); «html-range»
   альтернативы нет в типах. Перед сабмитом — `isValidTextAnchor` (есть в `anchor.ts`), финально
   бэк (`ANCHOR_INVALID`). Невалидный якорь не уходит на бэк.

Итог: движок доменно-агностичен (любая AST-сущность), но субстрат-специфичен (только AST-блоки) —
и это закреплено структурно/рантайм/типами, а не подразумевается.

## 8. Устойчивость anchor / сироты

Источник истины — **`exact`** (процитированный фрагмент) + контекст `prefix`/`suffix`; офсеты
`block_id`+`char` (UTF-16) — быстрый хинт для локализации (см. `philosophy-api`
`docs/domain/anchors.md`). Бэк хранит anchor «opaquely» (не читает/не пересчитывает офсеты,
единственная серверная проверка — `>= 0`).

**Бэк-гард `BLOCKS_HAVE_ANCHORS` (409) меняет картину сирот.** Удалить блок, к которому привязан
якорь, нельзя — правка тела отклоняется (`aststore.CheckAnchorsOnRemove`, на путях
document/comment/glossary). Значит структурная потеря якоря (блок исчез) бэком **исключена**;
«сиротский» путь сведён к **смысловому дрейфу текста внутри сохранённого блока** (тот же
`block_id`, но текст/офсеты разошлись). Это концерн **редактирования документа**, не аннотаций
(см. §9).

Стратегия ре-анкоринга (FE): (1) офсеты `block_id`+`char`, сверка с `exact`; (2) если не совпало —
**квота-поиск `exact` ВНУТРИ того же блока** (он гарантированно жив) с дизамбигуацией
`prefix`/`suffix`; (3) последний резерв — квота-поиск по всему руту. Не нашли (крайне редко, т.к.
блок жив) → карточка-сирота в начале колонки с цитатой и пометкой, без подсветки.

## 9. Контракт с бэком (статус после фиксов 2026-06-24)

- ✅ **Единицы офсетов — РЕШЕНО.** Схема дословно: `start_char`/`end_char` — «UTF-16 code units
  (JS String.length / DOM Range semantics). Stored opaquely.» Совпадает с ядром; конверсия не
  нужна; бэк не нормализует.
- ✅ **Per-entity роуты — РЕШЕНО.** `/api/documents/{id}/annotations` и др. теперь в OpenAPI
  (`schema.ts`); фикция `/api/entities/{type}/...` удалена. Следствие: **снять ручной-fetch
  стопгап** в `actions.ts`/`api.ts`, перейти на типизированный клиент (по правилу AGENTS «корень
  починен → убрать обход»). Из новых кодов в ERRORS аннотаций уместен `IDEMPOTENCY_KEY_IN_USE`.
- ✅ **Нормализация `exact` — РЕШЕНО** (de facto): «stored opaquely» → бэк не трогает, FE владеет.
  Авторитетный якорь — `exact`; офсеты — хинт (`anchors.md`).
- ✅ **`block_id` — глобально уникальный UUID** (`anchors.md`): у блоков стабильные id. Остаётся
  лёгкая FE-проверка — отдаёт ли GET-payload `id` у ВЛОЖЕННЫХ блоков (`content[].id` в
  list_item/blockquote). Если часть без id — анкоринг ограничен блоками с id (не блокер).
- ⚠️ **Cross-feature follow-up (НЕ в этой фиче):** `BLOCKS_HAVE_ANCHORS` (409) — ошибка
  **редактирования документа** (`aststore.CheckAnchorsOnRemove`: попытка удалить запинённый блок),
  не создания аннотации. Слайс `documents` (edit/save action) должен ловить 409 и показывать
  автору branded-сообщение «у блока есть аннотации — снимите/перенесите». В ERRORS аннотаций НЕ
  входит. Зафиксировать задачей для `documents`.
- 📄 **Первоисточник:** `philosophy-api/docs/domain/anchors.md` (единицы, opaque-хранение, дрейф,
  гард удаления блока).

## 10. Токен подсветки (foundation)

Завести `--color-highlight` (+ `--color-highlight-active`) в генераторе токенов
(`src/styles/tokens/`), 4 комбо тема×контраст, и добавить APCA-пары `fg`-on-highlight в
`CONTRAST_PAIRS` (`apca-targets.ts`) — чтобы CI-гард покрыл читаемость текста на подсветке.
Переиспользование `--color-accent` (амбер primary) отклонено: семантический конфликт + вне
APCA-гарантий. Это отдельное foundation-касание токенов (координированно по AGENTS).

## 11. Тестирование

Ядро (Vitest+jsdom): `stacking` (наезды/порядок/сумма); `dom-text` (офсеты, `<br>`→\n,
**кириллица + эмодзи** — UTF-16); `anchor-from` (одно/кросс-блок, collapsed, контекст);
`anchor-to` (точный путь, фолбэк-дизамбигуация **дубликатов**, сирота, `CSS.escape`-guard);
`highlight-controller` (apply/clear, фолбэк-ветка); `hit-test`; мапперы anchor.
Дельта фичи: `permissions.test.ts`/`schemas.test.ts` (anchor JSON).
**Честно:** позиционная геометрия (`getBoundingClientRect`/`Range.getBoundingClientRect` —
в jsdom бросает/нули) НЕ юнит-тестируема → ручной браузер-QA (фиксируется явно).

## 12. Фазировка

1. Ядро (`stacking`/`dom-text`/`anchor-from`/`anchor-to`/`highlight-controller`/`hit-test`) + тесты.
2. DOM-контракт `data-block-id` (foundation, без table).
3. Foundation-токен `--color-highlight` + APCA-пара.
4. React-слой: захват (selectionchange+touch+keyboard), аффорданс, позиционирование (референс+RO+
   narrow+strut), подсветка + оверлей-фолбэк.
5. Двусторонний клик (hit-test + setActive + скролл reduced-motion).
6. Обвязка: общий сборщик карточек, SSR-фолбэк, ref-discovery, урезанная модалка + onClose,
   reading-mode, AT-семантика. Снять ручной-fetch стопгап (типизированный клиент).
7. Монтаж на странице + ручной браузер/тач/RTL/a11y-QA.

## 13. Вне scope / известные ограничения v1

- **Перекрытия аннотаций** красятся плоским объединением (границы не видны); дизамбигуация —
  только хит-тестом при клике. Полноценная визуализация перекрытий — follow-up.
- **Печать/PDF:** CSS Highlight не печатается → аннотированность на бумаге несёт SSR-список
  карточек (с цитатами), не in-text подсветка.
- Офлайн-создание (slice A — пауза); media-interval якоря; глоссарий/комменты как поверхности
  (движок готов, подключение — отдельно); поднятие reading-mode до оси appearance.

## 14. Инвентарь файлов

**Движок `src/components/annotation-layer/`:** `types.ts`, `stacking.ts`, `dom-text.ts`,
`anchor-from-selection.ts`, `anchor-to-range.ts`, `highlight-controller.ts`, `hit-test.ts`
(+ тесты); `annotation-layer.tsx`, `selection-affordance.tsx`, `margin-notes-column.tsx`,
`highlight-overlay.tsx`, `index.ts`.

**Foundation:** `ast-render/block-renderer.tsx` (+ тест) — `data-block-id`;
`styles/tokens/*` + `apca-targets.ts` — `--color-highlight`; `app/globals.css` — `::highlight`.

**Обвязка `src/features/annotations/`:** `anchor.ts` (мапперы), `ui/annotation-create-form.tsx`
(anchor-проп + onClose), `ui/annotation-composer-dialog.tsx`, `ui/document-annotation-layer.tsx`,
`ui/document-annotations.tsx`, `ui/annotation-cards-builder.tsx` (общий сборщик), `actions.ts`/
`api.ts` (типизированный клиент вместо ручного fetch), `index.ts`.

**Страница:** `app/documents/[id]/page.tsx` — client-обёртка контент-рута + монтаж.

**i18n:** ключи в `messages/{ru,en,ar,zh}/annotations.ts` (pseudo en-XA — авто из en).

# Под-блочная адресуемость якорей (node_id) — FE-поддержка, Core

- **Дата:** 2026-06-30
- **Статус:** дизайн одобрен, готов к плану
- **Тип:** поддержка ломающего бэкенд-контракта (migration 026; прода нет)
- **Нормативный источник:** [philosophy-api/docs/domain/anchors.md](../../../../philosophy-api/docs/domain/anchors.md) §«Под-блочная адресуемость (node_id)»

## Контекст и проблема

До migration 026 текстовый якорь (аннотации + комментарии) адресовал только
верхнеуровневый `ast.Block`, а `exact`/`prefix`/`suffix` и офсеты резолвились
по **склеённому** тексту всего составного блока (`list`/`blockquote`/`table`).
Следствия:

- Якорение **внутри таблиц невозможно**: короткие повторяющиеся значения ячеек
  (`✓`/`Да`/`Нет`/числа) дают неуникальный `exact`, а офсеты пересекают границы
  ячеек — получается «мусорный якорь».
- Под-блочная структура списков и цитат (вложенные абзацы) скрыта — нельзя
  заякориться к конкретному пункту/абзацу.

Бэк решил это **под-блочной адресуемостью**: якорь приобретает второй уровень —
`node_id` (текстовый лист). Контракт **ломающий**: прежняя форма (только
`block_id`, без `node_id`) более не валидна. Схема перегенерирована 2026-06-30 —
`anchor.Position`/`annotation.Anchor`/`comment.Anchor` несут
`start_node_id`/`end_node_id` рядом с `start_block_id`/`end_block_id`.

Этот документ описывает **FE-поддержку**. Бэкенд-часть (минт, валидатор, гард,
сортировка) уже реализована и описана в нормативном источнике — здесь не
дублируется.

## Объём (Core)

В Core входит:

- **node_id round-trip** — editor-атрибуты + dedup + сериализатор/гидрация на всех
  текстовых листах (включая вложенные).
- **anchor-engine** — капчур и резолв по `node_id` для двух случаев диапазона:
  **within-leaf** (`start_node_id == end_node_id`) и **линейный кросс-лист**
  (`start_node_id != end_node_id`, ни один конец не ячейка).
- **Таблицы — single-cell**: якорение в пределах **одной** ячейки (это частный
  случай within-leaf, новой геометрии не требует).
- **Списки и цитаты** — вложенные абзацы (`list_item`/`blockquote` content
  включает `paragraph`) обслуживаются той же машинерией within-leaf + линейного
  кросс-листа. Отдельной геометрии не требуют (линейный поток).

**Вне Core (Phase 2 / отложено):**

- **Multi-cell table-rectangle** — выделение по двум углам разных ячеек одной
  таблицы → 2D-прямоугольник подсветки по геометрии. Единственная по-настоящему
  новая геометрия; в Core cross-cell выделение запрещено на капчуре.
- Из нормативного источника §«Сознательно отложено»: Composite (1:N, разрывные
  цели), серверный resolve / orphan-drift status на чтении, TimeState
  (version-pinning), Motivation/purpose словарь. Плюс бэк-долг: серверный
  node-diff гард против спурьозного орфана.

## Модель данных

Текстовый якорь = два уровня:

- **`block_id`** — верхнеуровневый блок (`list`/`table`/`blockquote`/
  standalone-абзац). По нему работают бэкенд-гард `BLOCKS_HAVE_ANCHORS` и
  document-order сортировка маргиналий.
- **`node_id`** — текстовый **лист**, в котором резолвятся офсеты и `exact`.
  **Всегда заполнен.** Для standalone-абзаца/heading/code_block верхнего уровня
  `node_id == block_id` (блок одновременно является текстовым листом).

**Текстовые листы (несут `id`):** `paragraph`, `heading`, `code_block`
(top-level **и** вложенные в `list_item`/`blockquote`) + `table_cell` (всегда
вложенный).

**Без `id`:** структурные узлы (`list`, `list_item`, `blockquote`, `table`,
`table_row`) и не-текст-листы (`image`, `thematic_break`).

**Важно:** `node_id` heading — это системный `Node.ID`, **не** `attrs.id`
(TOC-слаг). Это разные поля.

**Подход (выбран на брейншторме — вариант A):** единый AST-поле `id` на каждом
листе/блоке. Минтит **бэкенд** (`aststore.MintNodeIDs`); FE **round-трипит** `id`
как делает для `block_id`. Клиентский минтинг (TipTap UniqueID) **не
используется** — создал бы конфликтующую модель владения id. Отвергнутые
альтернативы: B (отдельный `nodeId`-атрибут — дубль UUID на топ-листе, лишний
код), C (`node_id` только на вложенных листах — ветвление в горячем коде
капчур/резолв).

## Архитектура (по слоям)

### Слой 1 — Editor round-trip

| Точка | Изменение |
| --- | --- |
| [serializer.ts](../../../src/components/ast-editor/serializer.ts) | Эмитить AST `id` и на **вложенных** текст-листах (`table_cell`, абзацы/heading/code внутри `list_item`/`blockquote`). На структурных узлах — не эмитить. |
| Гидрация AST→PM | Заселять `blockId`-атрибут вложенных листов из AST `id` (иначе round-trip рвётся → бэк ре-минтит → тихий орфан). |
| [dedup-block-id-plugin.ts](../../../src/components/ast-editor/extensions/dedup-block-id-plugin.ts) | Расширить обход с `doc.children` на вложенные текст-листы: дубль `node_id` (paste/split строки или пункта) → чистить на insertion-side, бэк ре-минтит. |

Существующий атрибут `blockId` ([block-id-attr.ts](../../../src/components/ast-editor/extensions/block-id-attr.ts)) переиспользуется как универсальный носитель AST `id` на каждом уровне. Новый PM-атрибут не вводится.

### Слой 2 — Read-рендер DOM-контракт

[node-map.ts](../../../src/components/ast-content-map/node-map.ts) + read-адаптер
эмитят:

- `data-block-id` — на **топ-блоке** (в т.ч. **возвращаем на `<table>`** — сейчас
  намеренно снят).
- `data-node-id` — на **каждом текстовом листе** (`<p>`/`<h*>`/`<pre>`/`<td>`).
- топ-абзац/heading/code (= и блок, и лист) → несёт **оба** атрибута с одним
  значением.
- вложенный лист (ячейка, абзац в списке/цитате) → **только** `data-node-id`
  (не `data-block-id`, иначе `closest('[data-block-id]')` зарезолвит в лист
  вместо объемлющего блока).

Это требует, чтобы рендер различал top-level и вложенный лист (сейчас
`paragraph`-рендерер безусловно зовёт `blockIdAttr`). Деталь реализации — в плане.

### Слой 3 — Anchor engine

**`TextAnchor`** ([types.ts](../../../src/components/anchor-engine/types.ts)):
добавить `startNodeId`/`endNodeId` рядом с block-id. **`startChar`/`endChar`
становятся node-relative** (офсет внутри листа, не склейки блока).

**Капчур**
([anchor-from-selection.ts](../../../src/components/anchor-engine/anchor-from-selection.ts)):
на каждый конец выделения —

- `leaf = closest('[data-node-id]')` → `node_id`;
- `block = closest('[data-block-id]')` → `block_id`;
- оба обязаны существовать и быть внутри AST-рута, иначе якорь не создаётся;
- офсет и `prefix`/`suffix` считаются от **листа** через существующий
  [dom-text.ts](../../../src/components/anchor-engine/dom-text.ts) (лист несёт
  только свой инлайн-текст — функции работают без правок, им скармливается лист);
- **single-cell гард:** лист-ячейка детектится по `tagName ∈ {TD, TH}`; если хоть
  один конец — ячейка, требуется `startLeaf === endLeaf` (та же ячейка), иначе
  якорь не создаётся (аффорданс гаснет молча). Не-табличный кросс-лист
  (проза/списки/цитаты) — разрешён.

**Резолв**
([anchor-to-range.ts](../../../src/components/anchor-engine/anchor-to-range.ts)):

- лист по `[data-node-id]`;
- быстрый путь — офсеты внутри листа + сверка `exact` (authoritative);
- фолбэк — квота-поиск (`exact` + `prefix`/`suffix`), scoped лист → блок → рут;
- within-leaf и линейный кросс-лист поддержаны;
- table-rectangle (обе ячейки, разные) в Core не производится; если встретится —
  резолвер отдаёт `null` (мягкий орфан, без падения).

### Слой 4 — Конвертер (единый шов) + фичи

[@/utils/text-anchor](../../../src/utils/text-anchor.ts) `engineAnchorToCoords` и
обратный маппинг расширяются на `start_node_id`/`end_node_id`. Оба домена идут
через него, поэтому
[comments/anchor.ts](../../../src/features/comments/anchor.ts) и
[annotations/anchor.ts](../../../src/features/annotations/anchor.ts) подхватывают
node-грань почти без правок.

> ⚠️ `@/utils/text-anchor` — общая инфраструктура (`src/utils/*`, foundation).
> Правка координируется в рамках этого ломающего контракта.

### Слой 5 — Marginalia document-order

Добавить тай-брейк `start_node_id` после block-позиции + `start_char` (зеркалит
бэкендный `ORDER BY`) — стабильный порядок для нескольких листов одного блока
(node-relative `start_char` больше не упорядочивает их глобально). Конкретное
место сортировки — уточнить в плане.

## Тестирование (TDD, по слоям)

- **serializer:** `id` round-trip на вложенных листах (ячейка, абзац списка, абзац
  цитаты); структурные узлы — без `id`.
- **dedup:** дубль `node_id` чистится на insertion-side (paste/split).
- **read-render:** `data-node-id` на листах; `<table>` вернул `data-block-id`;
  вложенный лист — node-id без block-id; топ-лист — оба атрибута.
- **капчур:** node-relative офсет; `node_id` захвачен; single-cell гард
  (та же ячейка ок; cross-cell и cell+проза отклонены); линейный кросс-лист прозы
  ок.
- **резолв:** within-leaf; линейный кросс-лист; leaf-scoped квота-фолбэк;
  отложенный rectangle → `null`.
- **конвертер:** node-id оба направления (проза `node==block` и вложенные листы).
- **фичи:** comments/annotations якорь-билдеры несут node-id.

## Риски и known-limitations

1. **Спурьозный орфан**, если FE уронит `node_id` на UPDATE — серверного
   node-diff гарда нет. Митигация: дисциплина round-trip + dedup (покрыто
   тестами serializer/dedup).
2. **Удаление запинённого листа** (ячейка / вложенный абзац) **не гардится** —
   `BLOCKS_HAVE_ANCHORS` работает на block-гранулярности. → мягкий орфан, FE
   показывает (node_id не резолвится в дереве). Консистентно с прозой.
3. **Reading-order внутри составного блока** семантически не гарантирован
   (node-relative `start_char`), только pagination-stable через тай-брейк
   `start_node_id` — до серверного резолвера.
4. **Cross-cell выделение** в Core молча не даёт аффорданс — Phase 2 (rectangle).

## Миграция / совместимость

Прода нет (контракт ломающий по согласованию). Бэкфилла не требуется. Существующие
dev-якоря без `node_id` становятся невалидными — допустимо в dev.

## Запретные зоны / координация

- [src/api/schema.ts](../../../src/api/schema.ts) — перегенерирован пользователем
  2026-06-30 (координированно).
- [@/utils/text-anchor](../../../src/utils/text-anchor.ts),
  [node-map.ts](../../../src/components/ast-content-map/node-map.ts),
  anchor-engine, ast-editor extensions — субстрат аннотаций; правка в рамках этого
  контракта.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

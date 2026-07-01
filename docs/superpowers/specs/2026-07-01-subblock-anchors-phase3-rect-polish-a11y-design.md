# Под-блочные якоря Phase 3 — прямоугольник: полиш + a11y/touch

- **Дата:** 2026-07-01
- **Статус:** дизайн одобрен, готов к плану
- **Тип:** FE-only (бэк не меняется). Небольшой цельный пасс.
- **Предшественники:** [Core](2026-06-30-subblock-node-id-anchors-design.md), [Phase 2 table-rectangle](2026-07-01-subblock-anchors-phase2-table-rectangle-design.md) (оба на main).

## Контекст

Phase 2 включил прямоугольные якоря (две угловые ячейки одной таблицы: капчур
rule-4, `resolveAnchor` → `AnchorGeometry` rect|range, bbox-оверлей, point-in-bbox
хит-тест). Финальное ревью Phase 2 оставило три follow-up'а, которые собираются в
этот пасс:

1. Выноска-коннектор прямоугольника крепится у ВЕРХНЕГО края bbox (не в центре).
2. Overlay-массивы (`overlayRects`/`activeOverlayRects`) строятся немемоизированно.
3. a11y/touch прямоугольного выделения не разобраны явно.

## Объём (одним циклом)

- **Connector center-attach** — kind-aware точка крепления выноски.
- **Overlay мемоизация** — perf-микрофикс.
- **a11y/touch (ограниченно):** тач-СОЗДАНИЕ (подтверждение device-agnostic
  цепочки) + потребление (наследуется) + явные known-limits.

**Вне объёма (known-limits, ниже):** клавиатурное СОЗДАНИЕ cell-прямоугольника
(grid-виджет), кастомный тач-cell-drag, nested-table прямоугольник.

## 1. Connector center-attach

**Проблема.** [connector-layer.tsx:61](../../../src/components/anchor-engine/connector-layer.tsx)
вычисляет точку крепления выноски к якорю как
`anchorY = anchorTop + Math.min(a.height, FIRST_LINE_CLAMP_PX) / 2`
(`FIRST_LINE_CLAMP_PX = 24`). Для линейного якоря это центр ПЕРВОЙ строки —
корректно. Для прямоугольника `a` = bbox всей области (высотой в строки таблицы),
и `anchorY` ложится у верхнего края → выноска указывает на верх, а не в центр
области.

**Решение (подход A — выбран).** Оркестратор владеет `geometries` (несёт `kind`);
он строит `rectIds: Set<string>` и пробрасывает в `ConnectorLayer`. Коннектор
ветвит точку крепления:

```ts
const anchorY = rectIds.has(id)
  ? anchorTop + a.height / 2                              // прямоугольник → центр bbox
  : anchorTop + Math.min(a.height, FIRST_LINE_CLAMP_PX) / 2; // линейный → центр первой строки
```

Всё остальное (`attachYs`, локоть, выбор стороны — RTL-safe) без изменений.
`FIRST_LINE_CLAMP_PX` остаётся в коннекторе (его концепт); `kind` приходит снаружи
через `rectIds` — концерны разделены. (Отвергнуто: B — `getAnchorAttachY` из хука
тянет connector-константу в хук; C — attach-Y в `AnchorGeometry` смешивает
connector-концерн в резолвер.)

**Карточка остаётся top-aligned.** `MarginNotesColumn` позиционирует карточку по
`getAnchorRect(id).top` (как у всех якорей); стекинг колонки по top не трогаем.
Смещение «центр якоря ↔ верх карточки» уже разрешается локтем `attachYs`.
Центрирование самой карточки прямоугольника — вне объёма (усложнило бы стекинг).

**Файлы:** `connector-layer.tsx` (проп `rectIds` + kind-branch),
`margin-anchor-layer.tsx` (построить `rectIds`, пробросить).

## 2. Overlay мемоизация

**Проблема.** [margin-anchor-layer.tsx](../../../src/components/anchor-engine/margin-anchor-layer.tsx)
(Phase 2) строит `overlayRects`/`activeOverlayRects` plain-массивами на каждый
рендер → новая идентичность → `HighlightOverlay` `useLayoutEffect([rects,
activeRects])` перезапускается (переустановка resize/scroll-слушателей) каждый
рендер.

**Решение.** Обернуть построение обоих массивов в `useMemo` с deps
`[geometries, emphasizedId, highlightEnabled, controller]` (`controller.supported`
константна — покрыта идентичностью `controller`). Между recompute'ами `geometries`
стабильна (useMemo в `use-anchor-ranges`) → массивы стабильны. Поведение не
меняется.

**Тест:** отдельный НЕ заводим — это behavior-preserving refactor; identity-stability
юнит-тестировать бриттл. Покрыто существующими `margin-anchor-layer.test.tsx` +
широким `anchor-engine` (без регресса).

## 3. a11y/touch (ограниченно)

**Честная позиция:** выбранный объём (тач-создание + потребление) в основном уже
удовлетворён архитектурой; Phase 3 добавляет подтверждающие тесты + документ.

**Тач-создание = device-agnostic (подтверждение).**
[use-selection-capture.ts](../../../src/components/anchor-engine/use-selection-capture.ts)
строит якорь из `window.getSelection()` единообразно, слушая `selectionchange` +
`pointerup` + `touchend`. Кросс-ячеечное touch-выделение (где браузер его отдаёт)
проходит по той же цепочке, что pointer → Phase-2 rule-4 капчур → прямоугольный
якорь. Тач-специфичного кода НЕ требуется. **Тест** (`use-selection-capture.test.tsx`):
программное кросс-ячеечное Selection одной таблицы → `draft` с прямоугольным
якорем (`startNodeId ≠ endNodeId`, обе ячейки) — доказывает device-agnostic путь.

**Потребление = наследуется.** Прямоугольник даёт карточку как любой якорь
(anchored/orphan); карточка keyboard-доступна собственными контролами
([margin-notes-column.tsx](../../../src/components/anchor-engine/margin-notes-column.tsx)
дизайн: pointer-only активация — необязательный энхансмент поверх доступных
контролов карточки). Нового кода нет. **Лёгкий подтверждающий тест**: rect-нота →
карточка присутствует в колонке.

**Overlay/коннектор — декоративны:** `aria-hidden` + `pointer-events:none` (Phase 2 /
существующий дизайн) → a11y-регресса не вносят.

### Known-limits (в объёме документации)

1. **Клавиатурное СОЗДАНИЕ cell-прямоугольника — отложено.** Нативной поддержки
   выделения диапазона ячеек с клавиатуры нет; требует кастомного grid-виджета
   (focusable ячейки, roving tabindex, arrow-навигация, Shift-расширение
   прямоугольника кастомным состоянием, триггер «аннотировать») — задевает ВСЕ
   read-таблицы + семантику (`role="grid"`). Наследует pointer-only-создание движка.
2. **Надёжное тач кросс-ячеечное СОЗДАНИЕ** зависит от нативной браузерной
   touch-Selection по ячейкам (мобильные браузеры непоследовательны). Работает где
   браузер поддерживает; кастомный тач-cell-drag (touchmove-трекинг ячеек под
   пальцем) — отложен.
3. **Активация прямоугольника указателем** — pointer-энхансмент, не единственный
   путь: карточка и обратное направление доступны с клавиатуры.

## Тестирование (TDD)

- **connector-layer:** rect-id → `anchorY` = центр bbox (`top + height/2`); range-id
  → first-line clamp. Мок `getAnchorRect` + `rectIds`.
- **use-selection-capture:** программное кросс-ячеечное Selection → `draft` с
  прямоугольным якорем (device-agnostic).
- **margin-anchor-layer:** rect-нота → карточка в колонке; overlay-рендер без
  регресса после мемоизации (существующие тесты зелёные).

## FE/BE и координация

- **Бэк не меняется.** `src/api/schema.ts` не трогается.
- Затрагиваемые файлы — anchor-engine. Перед PR зелёные: `pnpm lint && pnpm test
  && pnpm build` (итерации — `pnpm exec vitest run <path>`; `!` запрещён — `must()`/`?.`).

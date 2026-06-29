# Дизайн: интерактивный просмотр канваса (zoom/pan поверх SSR)

Дата: 2026-06-29
Статус: дизайн одобрен, готов к плану

## Проблема

Read-only просмотр канваса ([`CanvasRender`](../../../src/components/canvas-render/canvas-render.tsx))
рисует статичный `<svg>` с `viewBox` по bounding box графа в контейнере `overflow:auto`.
Для больших графов это значит «весь граф ужат по ширине, детали не разглядеть, можно только
скроллить». В редакторе ([`canvas-editor.tsx`](../../../src/features/canvas/ui/canvas-editor.tsx))
давно есть pan/zoom (Figma-конвенции, зум-у-курсора, fit), но в просмотре их нет.

Нужно: дать зрителю зум/панораму/«уместить» при просмотре канваса — **сохранив текущий
SSR-рендер** (граф виден без JS, для SEO/no-JS), как прогрессивное улучшение поверх.

## Решение (обзор)

Подход **B** (прогрессивное улучшение клиентским компонентом):

1. Серверный `CanvasRender` остаётся как есть — это SSR/no-JS фолбэк.
2. Тело SVG извлекается в чистый client-safe компонент `CanvasScene` (переиспользуется
   и сервером, и клиентом — без дубля разметки).
3. Новый клиентский `CanvasViewer` рисует то же тело, но управляет `viewBox` из React-state;
   до измерения контейнера (SSR/гидрация) рендерит **идентичную статичную ветку**, после
   монтирования меряет контейнер и включает интерактив.
4. Жесты pan/zoom выносятся в **общий хук `usePanZoom`**, который подключается и во viewer,
   и в редактор → единый источник истины. Вся математика вьюпорта переиспользуется из
   существующего [`coords.ts`](../../../src/features/canvas/editor/coords.ts).

Применяется везде, где сейчас read-only канвас: страница `/canvases/[id]` и модалка ревизий
(обе рендерят `CanvasDetail` — единственная точка переключения).

## Принцип переиспользования

Заново НЕ пишем логику и рендер. Импортируем как есть:

| Что | Откуда | Назначение |
|-----|--------|-----------|
| `applyZoomAtPoint`, `fitViewport`, `screenToWorld`, `centerViewport`, `ZOOM_IN/OUT`, лимиты, тип `Viewport` | `editor/coords.ts` | математика вьюпорта |
| `resolveWheel` | `editor/interaction.ts` | Figma-конвенция колеса (ctrl→зум / shift→гориз / иначе пан) |
| `NodeShapeRender`, `EdgeShapeRender`, `ArrowMarkerDefs`, `boundingBox` | `components/canvas-render` | примитивы рендера (уже общие) |

Новый код — только: тонкий хук-клей `usePanZoom`, компонент `CanvasViewer`, извлечение
`CanvasScene`, правка `CanvasDetail`, рефактор редактора на хук.

## Компоненты

### `CanvasScene` (новый, `src/components/canvas-render/canvas-scene.tsx`)

Чистое (НЕ async, client-safe) тело SVG, извлечённое из `CanvasRender`.

```tsx
interface CanvasSceneProps {
  data: RenderData;
  resolveEntityRef: EntityRefResolver;
  viewBox: string;
  width: number | string;   // число (статика) | "100%" (интерактив)
  height: number | string;
  ariaLabel: string;
  /** style на <svg>: статика → {maxWidth:"100%",height:"auto"}; интерактив → {display:"block"} */
  svgStyle?: CSSProperties;
}
```

Рисует `<svg viewBox …><ArrowMarkerDefs/>{рёбра}{узлы}</svg>` — ровно как тело текущего
`CanvasRender` (строки 35–52). Экспортируется из `components/canvas-render/index.ts`.

### `CanvasRender` (правка, минимальная)

Оболочка остаётся async-серверной (резолвит `getT` для `emptyText`/aria, считает bbox/viewBox),
но тело отдаёт `<CanvasScene>`. Внешнее поведение и разметка не меняются (регрессионный
инвариант: вывод побайтово прежний).

### `CanvasViewer` (новый, `src/features/canvas/ui/canvas-viewer.tsx`, `"use client"`)

Read-only интерактивный просмотр. Пропсы:

```tsx
interface CanvasViewerProps {
  data: RenderData;
  className?: string;
  children?: ReactNode;   // оверлей (бейдж ревизии и т.п.)
}
```

Логика:

- Это `"use client"`-компонент, поэтому i18n и резолвер ссылок он строит сам — **как редактор**:
  `const t = useT("canvas"); const resolveEntityRef = useMemo(() => makeEntityRefResolver(t), [t])`
  (см. [canvas-editor.tsx:142](../../../src/features/canvas/ui/canvas-editor.tsx#L142)). Никакой
  сериализации entity_ref через границу RSC НЕ нужно. `aria`/`emptyText` — из `useT("common")`
  по тем же ключам `canvasRender.*`, что у `CanvasRender`. (Клиентские компоненты SSR-ятся под
  i18n-провайдером, как и редактор.)
- Состояние: `size: {width,height} | null` (мерим контейнер через `ResizeObserver`),
  `viewport: Viewport | null`.
- **Ветка «статика»** (`size === null`, т.е. SSR + первый клиентский рендер до измерения):
  рендер `<CanvasScene>` с `viewBox = bbox+MARGIN`, `width=vbW height=vbH`,
  контейнер `overflow:auto` — идентично текущему `CanvasRender` ⇒ гидрация без mismatch,
  no-JS видит весь граф.
- **Ветка «интерактив»** (после `useLayoutEffect` измерил контейнер): `viewport = fitViewport(bbox, size)`;
  `<CanvasScene>` с `viewBox` = `"{vp.x} {vp.y} {size.w/vp.zoom} {size.h/vp.zoom}"`,
  `width/height="100%"`, контейнер `overflow:hidden`, `cursor:grab`.
- Подключает `usePanZoom(containerRef, { viewport, onViewportChange:setViewport, getSize, enablePanDrag:true, disabled: viewport===null })`.
- **Мини-тулбар** (оверлей в углу, kit-кнопки — Guardrail 7, `pointer-events:auto`):
  `[−] [NN%] [+] [⤢ уместить]`. `+/−` → `applyZoomAtPoint(vp, ZOOM_IN/OUT, size.w/2, size.h/2)`;
  `NN%` (клик) → 100% по центру; `⤢` → `fitViewport`. `NN%` — реактивное `round(vp.zoom*100)`.
- a11y: контейнер `role="img"` + `aria-label`; кнопки тулбара с `aria-label`; опц. клавиши
  `+ / − / 0` по фокусу.

### `CanvasDetail` (правка)

Упрощается: больше не нужен `getT`/резолвер — только маппинг `CanvasData → RenderData` и
рендер `<CanvasViewer>` (тот сам резолвит i18n/ссылки клиентски):

```tsx
export function CanvasDetail({ data }: Props) {
  return (
    <CanvasViewer
      data={toRenderData(data)}
      className="rounded border border-(--color-border) bg-(--color-surface) p-2"
    />
  );
}
```

`CanvasDetail` перестаёт быть `async` (маппинг чистый). Через границу RSC идёт только
сериализуемый `RenderData` (числа/строки) — функции не пересекают границу.

## Общий хук `usePanZoom` (новый, `src/features/canvas/editor/use-pan-zoom.ts`)

Единый владелец жестов pan/zoom для viewer и редактора. **Controlled** — не владеет стейтом
вьюпорта (его держит консьюмер: редактор — в `canvasReducer`, viewer — в `useState`).

```ts
interface UsePanZoomOpts {
  viewport: Viewport | null;
  onViewportChange: (next: Viewport) => void;
  getSize: () => { width: number; height: number } | null;
  /** Должен ли pointerdown начать пан. boolean | предикат по событию. */
  enablePanDrag: boolean | ((e: PointerEvent) => boolean);
  /** Вызывается, когда enablePanDrag-предикат вернул false (не-пановый pointerdown). */
  onPointerDownOther?: (e: PointerEvent) => void;
  disabled?: boolean;
}
function usePanZoom(ref: RefObject<HTMLElement>, opts: UsePanZoomOpts): void;
```

Поведение:

- **wheel** (non-passive, `preventDefault`): `resolveWheel` → зум `applyZoomAtPoint(vp, factor, cursorX, cursorY)`
  ИЛИ пан `{ x: vp.x - dx/zoom, y: vp.y - dy/zoom }` → `onViewportChange`.
- **pointerdown**: если `disabled` → выход. `pan = typeof enablePanDrag === "function" ? enablePanDrag(e) : enablePanDrag`.
  Если `pan` → `setPointerCapture`, запомнить стартовую экранную точку + стартовый `viewport`, режим drag-pan.
  Иначе → `onPointerDownOther?.(e)`.
- **pointermove** (в drag-pan): дельта в экранных px → `onViewportChange({ zoom, x: startVp.x - dx/zoom, y: startVp.y - dy/zoom })`.
- **pointerup/cancel**: освободить capture, выйти из drag-pan.
- **пинч** (два указателя touch): отношение текущей/прошлой дистанции → `applyZoomAtPoint` в середине щипка;
  во время пинча пан подавлен.

Единственный владелец `pointerdown` на элементе. Wheel/пинч — безусловны (одинаковы у обоих
консьюмеров); различается только решение «начать ли пан», вынесенное в предикат.

### Рефактор редактора на хук

`canvas-editor.tsx` сейчас в своём pointerdown делает hit-test и разветвляет жест
(`pan | marquee | select-move | resize | edge-draw`). После рефактора:

- `enablePanDrag = (e) => resolveGesture(e, hitTest(...)) === "pan"` (через существующие
  `resolveBackgroundGesture`/`resolveNodeGesture`).
- `onPointerDownOther = (e) => …` — текущая логика marquee/select-move/resize/edge-draw.
- Собственный wheel-обработчик редактора и его ветка drag-pan удаляются (их берёт хук);
  редактор лишь мапит `onViewportChange` в свой `EditorCommand`/диспатч.
- Hit-test на pointerdown считается один раз и переиспользуется предикатом и `onPointerDownOther`
  (избежать двойного вычисления).

**Инвариант:** все редакторские жесты сохраняются 1:1 (space-pan, средняя кнопка, hand-tool,
touch-pan, marquee, select, move, resize, edge-draw, zoom-у-курсора). Требуется браузер-регресс
редактора.

## Поток данных и SSR

```text
CanvasDetail (server)                     CanvasViewer ("use client", SSR+hydrate)
  toRenderData(CanvasData)        ──prop──►  useT("canvas") → resolveEntityRef (как редактор)
                                            size=null → CanvasScene (статика, = текущий SSR)
                                            useLayoutEffect: измерить → fitViewport
                                            size set → CanvasScene (интерактив) + usePanZoom
```

- **SSR / no-JS:** сервер отдаёт статичный SVG (весь граф, скроллируемый) — как сейчас.
- **Гидрация:** первый клиентский рендер = статичная ветка (совпадает с SSR, нет mismatch),
  затем эффект меряет контейнер и переключает на интерактив (`fitViewport` ≈ тот же общий вид).
- `reduced-motion`: анимаций нет (viewBox меняется напрямую) — гейтить нечего.

## Начальный вид и лимиты

- Старт = `fitViewport(bbox, size)` — весь граф влез по центру (визуально как нынешний статичный вид).
- Зум/шаг/лимиты — из `coords.ts` (MIN 0.1, MAX 8, ±10% за щелчок).
- Вьюпорт НЕ персистится — сбрасывается на fit при каждой загрузке.

## Тестирование

- **Чистая математика** (`coords`, `interaction`, `resolveWheel`) — уже покрыта, не дублируем.
- **`usePanZoom`** — хук-тест (`renderHook` + реальный `div`): диспатч `new WheelEvent` → зум/пан
  вызывает `onViewportChange` с верным `Viewport`; `disabled` → не вызывает; на unmount слушатель
  снят. ⚠️ jsdom не реализует `PointerEvent` → drag-пан и пинч (pointer-механика) проверяются в
  браузер-QA, а их математика — это уже покрытые `coords` (`applyZoomAtPoint` + формула пана).
- **`CanvasViewer`** (RTL/jsdom): статичная ветка даёт `viewBox = bbox+MARGIN` (= текущий);
  тулбар `+/−/⤢` меняет `viewBox`; пустой граф → `emptyText`. ⚠️ jsdom не считает layout
  (`getBoundingClientRect→0`), `ResizeObserver` мокается; реальные wheel/pinch — только браузер.
- **`CanvasRender`/`CanvasScene`** — снапшот-инвариант: вывод не изменился после извлечения.
- **Регресс редактора** — браузер-QA полного набора жестов (см. инвариант выше).
- **Браузер-QA viewer:** зум-у-курсора (колесо/трекпад), drag-пан, тач-пинч, тулбар,
  no-JS фолбэк (view-source содержит SVG, граф скроллится), модалка ревизий, RTL, reduced-motion.

## Вне объёма (YAGNI)

Нет редактирования/выделения/маркизы во viewer; нет линеек и сетки; нет z-order; нет персиста
вьюпорта; нет миникарты. Read-only `CanvasRender` как самостоятельный SSR-компонент сохраняется
(другие возможные потребители + фолбэк).

## Затрагиваемые файлы

| Файл | Изменение |
|------|-----------|
| `src/components/canvas-render/canvas-scene.tsx` | новый — извлечённое тело SVG |
| `src/components/canvas-render/canvas-render.tsx` | правка — рендерит `CanvasScene` |
| `src/components/canvas-render/index.ts` | экспорт `CanvasScene` |
| `src/features/canvas/editor/use-pan-zoom.ts` | новый — общий хук жестов |
| `src/features/canvas/ui/canvas-viewer.tsx` | новый — интерактивный read-only просмотр |
| `src/features/canvas/ui/canvas-editor.tsx` | рефактор — потребляет `usePanZoom` |
| `src/features/canvas/ui/canvas-detail.tsx` | правка — маппинг + `CanvasViewer` (не-async) |
| `src/assets/icons/zoom-in-icon.tsx`, `zoom-out-icon.tsx` | новые иконки тулбара (нет в наборе) |
| `src/i18n/messages/*/canvas.ts` | 3 ключа `viewer.zoomIn/zoomOut/resetZoom` (fit — reuse `toolbar.fit`) |
| тесты | `use-pan-zoom.test.tsx`, `canvas-viewer.test.tsx`, существующий `canvas-render.test.tsx` остаётся зелёным |

Кросс-фичевых импортов нет: viewer/хук — внутри `features/canvas`; импорт `components/canvas-render`
разрешён (верное направление слоёв).

> ⚠️ Касание `src/components/canvas-render` (извлечение `CanvasScene`) — модуль канваса, не из
> замороженных `shared/app/permission/ui`. Если зона считается замороженной — fallback: тело SVG
> дублируется внутри `CanvasViewer`, `components/canvas-render` не трогаем.

## Бэкенд

Изменений контракта нет — задача чисто FE (UX вьюпорта). Бэкенд уже отдаёт layout-координаты узлов.

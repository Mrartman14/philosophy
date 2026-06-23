# Координаты камеры карты и графа в URL

Дата: 2026-06-24
Статус: design (одобрен пользователем, ждёт ревью спеки)
Тип: **foundation-update** (расширение 3D-фундамента `scene-3d`) + тонкая обвязка двух слайсов.

## 1. Задача и контекст

Пользователь хочет, чтобы положение камеры («координаты осей») на карте смыслов
([src/features/semantic-map/](../../../src/features/semantic-map/)) и графе ссылок
([src/features/reference-graph/](../../../src/features/reference-graph/)) отражалось
в URL. Цель — **двойная** (выбор пользователя): ссылка должна и *шариться* («смотри
вот сюда»), и *переживать рефреш* (вернулся на страницу — камера на месте, а не
сброшена на «весь кадр»).

Обе поверхности стоят на общем фундаменте
[src/components/scene-3d/](../../../src/components/scene-3d/): база
[ThreeSceneRenderer](../../../src/components/scene-3d/three-scene-renderer.ts) +
порт [SceneRenderer](../../../src/components/scene-3d/scene-renderer.ts), доменные
рендереры наследуют базу. Поэтому ядро делается один раз и переиспользуется.

### Что есть сейчас

- Камера живёт **только** внутри Three.js `OrbitControls`. На каждом маунте/смене
  модели/смене режима её сбрасывает `fitToBounds()`
  ([setModel → fitToBounds](../../../src/components/scene-3d/three-scene-renderer.ts#L100),
  [applyMode → fitToBounds](../../../src/components/scene-3d/three-scene-renderer.ts#L151)).
- В URL ничего из вида не попадает. У карты используется только `?q=` (поиск-оверлей).
- Режим 2D/3D хранится в `localStorage` (`semantic-map:mode` / `reference-graph:mode`).

### Два инсайта, определившие дизайн

1. **Живую камеру нельзя сделать controlled.** Во время жеста её двигает
   `OrbitControls` ~60 кадров/с в RAF-цикле — это по природе uncontrolled-значение.
   Прокачивать его через React/стор на каждый кадр = ре-рендеры + петля обратной
   связи. Поэтому единый источник истины (URL) держит только **сериализуемый,
   зафиксированный** вид; живую камеру владеет рендерер. Шов синхронизации: **IN** —
   в дискретные моменты (маунт), **OUT** — по завершению жеста.

2. **`fitToBounds` затирает любой ранний restore.** В маунте `fitToBounds` зовётся
   детерминированно после `setModel` и после `setMode`. Значит «выставить камеру на
   маунте» наивно нельзя. Решение (см. §4) — не машина состояний с подавлением fit,
   а **вызов `applyCamera` последним шагом маунта**: последнее слово побеждает, всё
   синхронно в одном тике — fitted-кадр на экране не мелькает.

## 2. Принятые решения

- **URL — единый источник истины** для персистируемого вида; шарится и переживает
  рефреш.
- **Режим 2D/3D кладём в URL явным тегом** (не выводим из длины массива координат).
  Режим — самостоятельная ось вида (тип проекции + управление), а не следствие
  координат; явный тег делает URL самоописательным. `localStorage` остаётся
  **фолбэком**, когда параметра режима в URL нет (URL всегда побеждает). Дублирования
  нет: значение по-прежнему живёт в одном месте (URL), просто отдельным полем.
- **Механика — нативная, без новых зависимостей.** Запись через
  `window.history.replaceState` (официально документированный в Next App Router способ
  обновить searchParams **без** перезапуска серверного компонента — иначе каждый
  pan/zoom рефетчил бы данные карты/графа). `nuqs` отклонён: добавляет зависимость в
  замороженный `package.json` **и** провайдер `<NuqsAdapter>` в замороженный
  [src/app/layout.tsx](../../../src/app/layout.tsx) — две «запретные зоны» ради
  ~30 строк, которые нативный history делает тем же механизмом.
- **`replace`, не `push`** — движения камеры не засоряют историю и кнопку «назад».
- **Тогл 2D⇄3D сохраняет текущее поведение** (ре-фит = «показать всё заново»), но
  после смены режима новый вид явно пишется в URL.

## 3. Формат URL

Два коротких параметра — чтобы легко мёржить и не сносить чужие (`?q=`):

- `m` = `2d` | `3d` — режим.
- `c` = округлённые float'ы через запятую:
  - **2D** (орто): `tx,ty,zoom` — **3 числа**. Камера смотрит строго вниз, поворота
    нет, `position.xy == target.xy` — достаточно центра пана и зума
    ([fitToBounds 2D](../../../src/components/scene-3d/three-scene-renderer.ts#L162-L177)).
  - **3D** (перспектива): `px,py,pz,tx,ty,tz` — **6 чисел**: позиция + target. `up`
    фиксирован `(0,1,0)`, ориентация выводится через `lookAt`
    ([fitToBounds 3D](../../../src/components/scene-3d/three-scene-renderer.ts#L178-L191)).

Пример: `/map?m=3d&c=1.23,0.45,2.1,0.1,0,0` или `/graph?m=2d&c=0.5,-0.2,1.8`.

Координаты нормализованы ~[-1,1], округление до **4 знаков** после точки (zoom — до
3) — URL остаётся коротким, точность визуально неразличима.

## 4. Расширение порта рендерера (фундамент `scene-3d`)

В порт [SceneRenderer](../../../src/components/scene-3d/scene-renderer.ts) и базу
[ThreeSceneRenderer](../../../src/components/scene-3d/three-scene-renderer.ts):

```ts
type CameraState = { mode: SceneRenderMode; values: number[] }; // 2d: [tx,ty,zoom]; 3d: [px,py,pz,tx,ty,tz]

getCamera(): CameraState | null;        // текущая камера → сериализуемый вид; null до mount/model
applyCamera(state: CameraState): void;  // выставить position/target/zoom + controls.update()
onSettle(cb: () => void): void;         // подписка на событие 'end' OrbitControls (раз на жест)
```

- `applyCamera` **защищён**: если `state.mode !== this.mode` — игнор (несогласованный
  вызов; режим должен быть выставлен до применения камеры).
- `onSettle` — **отдельный** колбэк, не трогает однослотовый
  [onChange](../../../src/components/scene-3d/three-scene-renderer.ts#L226-L228)
  (за ним остаются подписи). Слушатель `'end'` навешивается в `applyMode` рядом с
  существующим `'change'` (контролы пересоздаются при смене режима; `settleCb` —
  поле инстанса, переживает пересоздание).
- **Математику сериализации выносим в чистые хелперы** (как уже сделано с
  [camera-fit.ts](../../../src/components/scene-3d/camera-fit.ts),
  [project.ts](../../../src/components/scene-3d/project.ts)):
  `cameraToValues(...)` / `valuesToCamera(...)` — юнит-тестим без WebGL; методы
  рендерера — тонкие обёртки над ними.
- **Restore без подавления fit:** `applyCamera` вызывается последним шагом маунта,
  после `setModel` + `setMode`. Никакой `pendingCamera`-машины.

### Чистый модуль сериализации URL

`src/components/scene-3d/url-view.ts` (общий, чистый, тестируемый):

- `parseView(params: { m?: string; c?: string }): CameraState | null` — валидирует
  `m ∈ {2d,3d}`, парсит `c` в float'ы, **проверяет длину под режим** (3 для 2d, 6 для
  3d), любой NaN/несовпадение → `null`. Никогда не кидает.
- `formatView(state: CameraState): { m: string; c: string }` — округляет и склеивает.
- `writeViewToUrl(state)` — клиентский хелпер: **мёржит** в текущий `location.search`
  (сохраняя `q` и прочее), затем `window.history.replaceState`.

## 5. Поток данных

**Чтение (IN) — на сервере.** Страницы
[map/page.tsx](../../../src/app/map/page.tsx) и
[graph/page.tsx](../../../src/app/graph/page.tsx) (серверные компоненты) парсят `m`/`c`
через `parseView` и отдают `initialView?: CameraState` пропом в клиентский view.
Никакого `useSearchParams`/Suspense, ноль hydration-рассинхрона (сервер и клиент видят
один URL). Карта уже читает `searchParams` (для `q`) — добавляем парс вида; граф
начинает читать `searchParams`.

**Применение restore (один раз).** В lifecycle-эффекте `[model]` после
`setModel` + `setMode(restoredMode)`: если `initialView` есть и режим совпал —
`r.applyCamera(initialView)` (последний шаг). Применяется **единожды** (страж через
ref `restoredRef`), на последующих сменах `model` — обычный `fitToBounds`.

**Запись (OUT) — на клиенте.** `r.onSettle(...)` → debounce ~200 мс → `getCamera()` →
`writeViewToUrl({ mode, values })`. Shallow, без рефетча. Программные движения
(`fitToBounds`, `applyCamera`) `'end'` **не** шлют → авто-записи не вызывают; restore
сам себя не перезапишет.

**Тогл 2D⇄3D.** Эффект `[mode]` остаётся (ре-фит сохраняем). После `setMode(mode)`
явно пишем новый `m` + `getCamera()` (fitted-камера нового режима), чтобы рефреш
сохранял переключённый режим. **Первый прогон** эффекта на маунте запись **пропускает**
(страж через ref), чтобы не затереть восстановленный вид. `localStorage` режима
продолжаем писать как фолбэк.

## 6. Edge cases / обработка ошибок

- **Битый URL** (`c` не та длина / NaN / `m` не из {2d,3d}) → `parseView` → `null` →
  обычный `fitToBounds`. Никогда не кидаем.
- **Чужие параметры** (`q`) при записи сохраняются (мёрж, не перезапись).
- **Другой размер окна у получателя** → zoom + центр восстанавливаем точно,
  кадрирование подстраивается под вьюпорт (`orthoHalfH` от fit, zoom поверх) —
  приемлемо.
- **reduced-motion** → damping выключен
  ([setReducedMotion](../../../src/components/scene-3d/three-scene-renderer.ts#L124-L130))
  → позиция на `'end'` точная. У остальных лёгкая инерция оседает в пределах debounce —
  мелкий known-минус (камера может уехать на доли единицы после записи).
- **Пустая модель** (count 0) → `applyCamera` безвреден (не зависит от модели).
- **back/forward** камерой не засоряется (`replaceState`); живую синхронизацию вида с
  навигацией истории не делаем — вне объёма.

## 7. Тестирование

- **Юнит (vitest):**
  - `parseView` / `formatView` — round-trip, валидация (битый режим, длина, NaN,
    сохранение `q`, округление).
  - `cameraToValues` / `valuesToCamera` — round-trip для 2D и 3D.
  - Всё чистое, без WebGL.
- **Ручной браузер-QA** (WebGL, как и весь map/graph): restore-на-рефреш, шаринг
  ссылки между вкладками, тогл режима пишет URL, pan/zoom/орбита пишут URL по
  завершению жеста, битый URL не ломает страницу.
- Зелёный гейт перед PR: `pnpm lint && pnpm test && pnpm build`.

## 8. Объём и порядок

1. **Фундамент:** чистые хелперы (`cameraToValues`/`valuesToCamera`, `url-view.ts`) +
   юнит-тесты; расширение порта `SceneRenderer` и базы `ThreeSceneRenderer`
   (`getCamera`/`applyCamera`/`onSettle`).
2. **Карта:** парс `initialView` в `page.tsx` → проп; обвязка restore/write в
   [semantic-map-view.tsx](../../../src/features/semantic-map/ui/semantic-map-view.tsx).
3. **Граф:** то же в graph-странице и
   [graph-view.tsx](../../../src/features/reference-graph/ui/graph-view.tsx).

Запретные зоны (`schema.ts`, root/admin layout, `globals.css`, `ui/*`) — **не
трогаем**. Порт/база `scene-3d` правятся координированно как часть этого foundation-update.

## 9. Вне объёма (YAGNI)

- Кнопка «скопировать ссылку на вид» — не нужна, URL обновляется сам, копируется из
  адресной строки.
- Сохранение позиции **между** 2D и 3D (нет осмысленного отображения pan/zoom ↔ орбита).
- Живая синхронизация камеры с back/forward.
- Анимированный «полёт» к восстановленному виду (restore мгновенный, как `fitToBounds`).
- `nuqs` / стейт-либа.

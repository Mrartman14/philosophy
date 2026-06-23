# Координаты камеры карты и графа в URL

Дата: 2026-06-24
Статус: design (одобрен пользователем; **ревизия после мульти-агент ревью** — закрыты
3 блокера + damping + ряд major; ждёт повторного ревью спеки)
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
рендереры наследуют базу. Ядро делается один раз и переиспользуется.

### Что есть сейчас

- Камера живёт **только** внутри Three.js `OrbitControls`. На каждом маунте/смене
  модели/смене режима её сбрасывает `fitToBounds()`
  ([setModel → fitToBounds](../../../src/components/scene-3d/three-scene-renderer.ts#L100),
  [applyMode → fitToBounds](../../../src/components/scene-3d/three-scene-renderer.ts#L151)).
- В URL ничего из вида не попадает. У карты используется только `?q=` (поиск-оверлей).
- Режим 2D/3D хранится в `localStorage` через
  [readSavedMode](../../../src/components/scene-3d/ui/scene-mode-toggle.tsx)
  (`semantic-map:mode` / `reference-graph:mode`).
- Оба view загружаются `dynamic(() => …, { ssr: false })` через ленивые обёртки
  [semantic-map.tsx](../../../src/features/semantic-map/ui/semantic-map.tsx) /
  [graph.tsx](../../../src/features/reference-graph/ui/graph.tsx) — на сервере сам
  canvas-view **не рендерится**.

### Инсайты, определившие дизайн

1. **Живую камеру нельзя сделать controlled.** Во время жеста её двигает
   `OrbitControls` ~60 кадров/с в RAF-цикле — uncontrolled-значение. Поэтому URL
   (единый источник истины) держит только **сериализуемый, зафиксированный** вид;
   живую камеру владеет рендерер. Шов: **IN** — в дискретные моменты, **OUT** — по
   оседанию камеры после жеста.

2. **`fitToBounds` затирает ранний restore.** В маунте `fitToBounds` зовётся
   детерминированно после `setModel` и после `setMode`. Решение — не машина
   подавления fit, а **вызов `applyCamera` последним камера-меняющим шагом маунта**:
   последнее слово побеждает, всё синхронно в одном тике, fitted-кадр не мелькает.

3. **Всю гнильё-механику тайминга держим в рендерере, не в React.** Рендерер владеет
   `OrbitControls` и его событиями `start`/`change`/`end`, поэтому **settle-watch**
   (см. §4) и его таймер живут там же и чистятся в `applyMode`/`destroy()`. Это
   разом закрывает гонку «тогл × отложенная запись» и «запись после
   размонтирования»: смена режима и teardown сами отменяют отложенную запись. View
   лишь поставляет колбэк и пишет URL.

## 2. Принятые решения

- **URL — единый источник истины** для персистируемого вида; шарится и переживает
  рефреш. На write URL **всегда побеждает** localStorage.
- **Режим 2D/3D — в URL явным тегом** `m` (не выводим из длины массива координат).
  Режим — самостоятельная ось вида; `localStorage` остаётся **фолбэком**, когда `m`
  в URL нет. **`m` и `c` парсятся независимо** (см. §4): валидный `m` без `c` —
  легитимная ссылка «открыть в 3D, авто-fit».
- **Механика — нативная, без новых зависимостей.** Запись через
  `window.history.replaceState` — официально документированный в Next App Router
  способ обновить searchParams **без** перезапуска серверного компонента (иначе
  каждый pan/zoom рефетчил бы данные карты/графа). Это **намеренная дивергенция** от
  [frontend-conventions.md §3.5](../../frontend-conventions.md) (который предписывает
  `router.replace()`): `router.replace` в App Router ре-рендерит RSC и рефетчит
  данные. `nuqs` отклонён: добавляет зависимость в замороженный `package.json` **и**
  провайдер `<NuqsAdapter>` в замороженный
  [src/app/layout.tsx](../../../src/app/layout.tsx) — две «запретные зоны» ради ~30
  строк, которые нативный history делает тем же механизмом.
- **`replace`, не `push`** — движения камеры не засоряют историю и «назад».
- **Тогл 2D⇄3D сохраняет текущее поведение** (ре-фит = «показать всё заново»), но
  после смены режима новый вид явно пишется в URL.

## 3. Формат URL

Два коротких параметра — чтобы легко мёржить и не сносить чужие (`?q=`):

- `m` = `2d` | `3d` — режим.
- `c` = округлённые float'ы через запятую:
  - **2D** (орто): `tx,ty,zoom` — **3 числа**. Камера смотрит строго вниз, поворота
    нет, `position.xy == target.xy` (доказано: в 2D `enableRotate=false`
    [applyMode](../../../src/components/scene-3d/three-scene-renderer.ts#L138), pan
    двигает `target` и `position` одним дельтой) — достаточно центра пана и зума.
  - **3D** (перспектива): `px,py,pz,tx,ty,tz` — **6 чисел**: позиция + target. `up`
    фиксирован `(0,1,0)`, `fov`/`zoom` перспективы не меняются (dolly двигает
    `position`), ориентация выводится через `lookAt`. (Валидно, пока `up`
    мировой-фиксированный — текущий инвариант рендерера.)

Пример полной ссылки: `/map?m=3d&c=1.23,0.45,2.1,0.1,0,0`; режим-только:
`/graph?m=2d`.

**Округление:** координаты (включая 3D `pz`/`tz`) — до **4 знаков**; единственный 2D
`zoom` — до **3**. **Round-trip лоссовый** (см. §6 про кадрирование) — тесты
сверяют с допуском под округление, а не побайтово.

## 4. Фундамент `scene-3d`

### 4.1. Расширение порта рендерера

В порт [SceneRenderer](../../../src/components/scene-3d/scene-renderer.ts) и базу
[ThreeSceneRenderer](../../../src/components/scene-3d/three-scene-renderer.ts):

```ts
type CameraState = { mode: SceneRenderMode; values: number[] }; // 2d: [tx,ty,zoom]; 3d: [px,py,pz,tx,ty,tz]

getCamera(): CameraState | null;        // текущая камера → {mode, values} атомарно
applyCamera(state: CameraState): void;  // выставить position/target/zoom + controls.update()
onSettle(cb: () => void): void;         // колбэк по ОСЕДАНИЮ камеры после жеста (settle-watch)
```

- **`getCamera`** возвращает `null`, если `this.disposed` (поле уже есть,
  [destroy](../../../src/components/scene-3d/three-scene-renderer.ts#L290)),
  `!this.controls` **или** `!this.model` — чтобы поздний/осиротевший вызов не
  сериализовал дефолтную 1×1-камеру и не упал на `controls.target` после teardown.
  Иначе читает 2D `controls.target.xy` + `ortho.zoom`, либо 3D `persp.position` +
  `controls.target`.
- **`applyCamera`** защищён: если `state.mode !== this.mode` — игнор. **Предусловие
  (2D):** опирается на `orthoHalfH`, выставленный предыдущим `fitToBounds`; в
  последовательности маунта `setModel → fitToBounds` всегда отрабатывает раньше
  (см. §5), поэтому `orthoHalfH` не дефолтный. Метод НЕ применяется к torn-down
  рендереру (guard по `disposed`).
- **`onSettle` + settle-watch (ядро тайминга).** Слушатели `start`/`change`/`end`
  навешиваются в `applyMode` рядом с существующим `change`
  ([тут](../../../src/components/scene-3d/three-scene-renderer.ts#L146)) — контролы
  пересоздаются на каждой смене режима, поэтому переподписка обязательна; `settleCb`
  — поле инстанса, переживает пересоздание. Логика:
  - на `end` (жест завершён — pointerup / wheel-notch): взвести `awaitingSettle` и
    арм-таймер (~200мс);
  - на `change` **пока `awaitingSettle`**: ре-арм таймера (инерция damping шлёт
    `change` каждый кадр ~1.6–2с — таймер не сработает, пока глайд не остановится);
  - по срабатыванию таймера: `awaitingSettle=false`, вызвать `settleCb` (view читает
    `getCamera()` и пишет URL) — камера **уже осела**.
  - Программные движения (`fitToBounds`/`applyCamera`) шлют `change`, но **не**
    `start`/`end` → при `awaitingSettle=false` таймер не взведён → записи нет. Restore
    сам себя не перезапишет.
  - **Таймер чистится** в `applyMode` (смена режима отменяет устаревший settle →
    закрывает гонку E1) и в `destroy()` (размонтирование → закрывает гонку A1).

Математику сериализации выносим в **чистые хелперы** (как
[camera-fit.ts](../../../src/components/scene-3d/camera-fit.ts),
[project.ts](../../../src/components/scene-3d/project.ts)):
`cameraToValues(...)` / `valuesToCamera(...)` — юнит-тестим без WebGL; методы — тонкие обёртки.

### 4.2. Чистый модуль сериализации URL

`src/components/scene-3d/url-view.ts` (общий, чистый). Живёт в scene-3d, а **не** в
`@/utils`, потому что это shared-сериализация именно вида сцены для обеих
поверхностей, и Guardrail 9 запрещает фиче владеть общим кодом:

- `parseView(params: { m?: string; c?: string }): { mode: SceneRenderMode | null; camera: CameraState | null }`
  — **`m` и `c` независимо**: `mode` = `m`, если ∈ {2d,3d}, иначе `null` (→ фолбэк на
  localStorage у вызывающего); `camera` = непустой, только если `mode` валиден И `c`
  парсится в нужную длину (3/2d, 6/3d) И **все значения `Number.isFinite`** И (для 2D)
  **`zoom > 0`** (защита от деления на ноль в орто-проекции). Любая порча → `camera:
  null`, но валидный `mode` сохраняется. Никогда не кидает.
- `formatView(state: CameraState): { m: string; c: string }` — округляет (§3),
  нормализует `-0`→`0`.
- `writeViewToUrl(state)` — клиентский хелпер: `new URLSearchParams(location.search)`
  → `.set("m",…)/.set("c",…)` (**мёрж**, сохраняя `q` и прочее) → `replaceState(null,
  "", location.pathname + "?" + params + location.hash)` (**сохраняем hash**).

Все публичные символы (`parseView`/`formatView`/`writeViewToUrl`, `CameraState`,
`cameraToValues`/`valuesToCamera`) экспортируются через
[scene-3d/index.ts](../../../src/components/scene-3d/index.ts) — слайсы импортируют
только из барреля (frontend-conventions §1). `index.ts` — редактируемый файл этой работы.

## 5. Поток данных

### 5.1. Чтение (IN) — на сервере + инициализация состояния

Страницы [map/page.tsx](../../../src/app/map/page.tsx) и
[graph/page.tsx](../../../src/app/graph/page.tsx) (серверные компоненты) зовут
`parseView(searchParams)` и отдают `initialView: { mode, camera }` пропом **через
ленивые обёртки** `SemanticMap`/`Graph` в клиентские view (обёртки сейчас
прокидывают только `data`/`overlay` — добавляем `initialView`).

**Режим (фикс H1).** `useState(mode)` и `modeRef` инициализируются как
`initialView.mode ?? readSavedMode(KEY)` — **URL побеждает localStorage**. Поэтому
(а) тогл [MapModeToggle](../../../src/features/semantic-map/ui/semantic-map-view.tsx#L150)
показывает восстановленный режим, и (б) `r.setMode(modeRef.current)` ставит
`this.mode` так, что guard `applyCamera` совпадёт. Без этого шаренная `?m=3d` была бы
мертва (camera-guard молча не сработал бы).

**Применение restore.** В lifecycle-эффекте `[model]`, последним камера-меняющим
шагом (после `setModel`, `setMode`, `setReducedMotion`, `setOverlay` — ни один из
последних трёх камеру не двигает, но «последний» считаем по факту списка вызовов):
`if (initialView.camera) r.applyCamera(initialView.camera)`. **Без `restoredRef`
(фикс C1):** эффект `[model]` и так перезапускается только на реальной смене
`model`/`data` (shallow-write через `replaceState` сервер не перезапускает → проп
стабилен → эффект не бежит → клоббера нет). Поэтому применяем `initialView.camera`
при **каждом** прогоне эффекта, когда камера есть и режим совпал — это консистентно
(URL = SSOT), без петли «OUT→IN».

`initialView` читается на сервере единожды на рендер и **намеренно не** живой URL;
shallow-записи его не меняют. Реальную причину отсутствия hydration-рассинхрона
формулируем честно: **view грузится `ssr:false`, на сервере не рендерится вовсе** —
все чтения URL/localStorage клиентские, hydration-границы нет (зеркало паттерна
user-timezone, но через `ssr:false`, а не `suppressHydrationWarning`).

### 5.2. Запись (OUT) — на клиенте

`r.onSettle(() => { const v = r.getCamera(); if (v) writeViewToUrl(v); })`. Settle-watch
(§4.1) гарантирует: запись — после оседания камеры (damping-инерция учтена честно),
программные движения не пишут, размонтирование/смена режима отменяют отложенную
запись на уровне рендерера. `getCamera()` отдаёт `{mode, values}` **атомарно** — `m` и
`c` всегда согласованы по длине.

### 5.3. Тогл 2D⇄3D

Эффект `[mode]` остаётся (ре-фит сохраняем). После `setMode(mode)` явно пишем
`writeViewToUrl(getCamera())` (новый режим + fitted-камера), чтобы рефреш сохранял
переключённый режим. **Первый прогон** эффекта на маунте запись **пропускает** (страж
через ref — **component-lifetime**, как `modeRef`), чтобы не затереть восстановленный
вид. Гонки с settle-записью нет: `setMode → applyMode` уже **очистил** settle-таймер
(§4.1). `localStorage` режима продолжаем писать как фолбэк.

## 6. Edge cases / обработка ошибок

- **Битый/частичный URL:** `c` не той длины / NaN / не-finite / `m` не из {2d,3d} →
  `camera: null` (валидный `mode` сохраняется) → авто-fit. `zoom <= 0` отвергается
  (иначе деление на ноль в орто-проекции). Никогда не кидаем.
- **`m`-only** (`?m=3d` без `c`): режим применяется, камера — авто-fit. Валидный сценарий.
- **Запись после размонтирования (A1):** settle-таймер чистится в `destroy()`;
  плюс `getCamera()` отдаёт `null` при `disposed` — двойная защита от записи `m/c` на
  URL уже **другой** страницы (клик по узлу графа = `router.push`,
  [graph-view](../../../src/features/reference-graph/ui/graph-view.tsx#L108)).
- **Гонка тогл × settle (E1):** `applyMode` чистит settle-таймер при смене режима →
  устаревшая запись не падает; mode-запись пишет согласованный `{mode, values}`.
- **Чужие параметры** (`q`) при записи сохраняются (мёрж + сохранение hash).
- **Другой размер окна у получателя:** zoom + центр восстанавливаем точно,
  кадрирование подстраивается под вьюпорт (`orthoHalfH` от fit под текущий aspect,
  zoom поверх) — принятый лоссовый round-trip.
- **damping/инерция (фикс major):** settle-watch ждёт **полного оседания** камеры
  (ре-арм на каждый `change` глайда), поэтому в URL попадает осевшая позиция, а не
  «на полпути». `reduced-motion` → damping выключен
  ([setReducedMotion](../../../src/components/scene-3d/three-scene-renderer.ts#L124-L130))
  → оседание мгновенное.
- **Пустая/вырожденная модель** (count 0, одна точка, совпадающие точки): `fit2D/fit3D`
  уже клампят (`1e-6` пол на размер, радиус>0) → `getCamera()` отдаёт finite. На
  всякий — `formatView`/`getCamera` не выпускают не-finite. Микроскопический frustum
  при нулевых bounds → визуально нечего ломать.
- **back/forward:** камерой не засоряется (`replaceState`); живую синхронизацию вида с
  навигацией истории не делаем (вне объёма). При этом **back-навигация, ре-рендерящая
  страницу на сервере, получит последний записанный `m/c` из URL** → камера
  восстановится (желаемый побочный эффект, не сюрприз).

## 7. Тестирование

- **Юнит (vitest), без WebGL:**
  - `parseView` — независимость `m`/`c`; отказ на длину/NaN/не-finite/`zoom<=0`;
    `m`-only; сохранение валидного `mode` при битом `c`.
  - `formatView` — округление, нормализация `-0`.
  - `writeViewToUrl` — мёрж (сохранение `q`), сохранение `hash`.
  - `cameraToValues`/`valuesToCamera` — round-trip 2D и 3D **с допуском** под
    округление (значение, округляющееся к `±0`, в наборе).
- **Ручной браузер-QA** (WebGL): restore-на-рефреш; шаринг между вкладками **с другим
  localStorage-режимом** (H1); тогл режима пишет URL и не гонится с settle (E1);
  pan/zoom/орбита пишут по оседанию (damping); клик по узлу/навигация во время глайда
  не пишет в чужой URL (A1); битый URL не ломает страницу.
- Зелёный гейт перед PR: `pnpm lint && pnpm test && pnpm build`.

## 8. Объём и порядок (задачи)

1. **Фундамент `scene-3d`:**
   - чистые хелперы `cameraToValues`/`valuesToCamera` + `url-view.ts`
     (`parseView`/`formatView`/`writeViewToUrl`) + юнит-тесты;
   - порт `SceneRenderer` + база `ThreeSceneRenderer`: `getCamera`/`applyCamera` +
     `onSettle`/settle-watch (арм/ре-арм/чистка в `applyMode`+`destroy`); guard'ы по
     `disposed`/`model`/`mode`;
   - экспорт всех символов через **`scene-3d/index.ts`**.
2. **Карта:** `parseView` в [map/page.tsx](../../../src/app/map/page.tsx) (`m`/`c` к
   уже читаемому `q`) → `initialView` через обёртку
   [semantic-map.tsx](../../../src/features/semantic-map/ui/semantic-map.tsx) →
   обвязка restore/write + инициализация режима из URL в
   [semantic-map-view.tsx](../../../src/features/semantic-map/ui/semantic-map-view.tsx).
3. **Граф:** `graph/page.tsx` **начинает принимать `searchParams`** (сейчас сигнатура
   без параметров; страница и так динамическая — зовёт `getGraph()` на запрос, так что
   static→dynamic регрессии нет) → `initialView` через обёртку
   [graph.tsx](../../../src/features/reference-graph/ui/graph.tsx) → обвязка в
   [graph-view.tsx](../../../src/features/reference-graph/ui/graph-view.tsx).
   **Внимание:** эффект graph-view имеет более широкие deps
   (`[model, labelNodes, typeById, router]`) — settle/cancel/restore вешать на его
   фактический lifecycle, не предполагать `[model]`-only как у карты.

**Governance:** `scene-3d` **не** в списке замороженных зон (AGENTS.md замораживает
`schema.ts`, root/admin layout, `globals.css`, `ui/*`, `components/{shared,app,…}`,
`package.json`); на него распространяется лишь **Guardrail 9** (фундамент не импортит
`@/features/*`) — правится нормально, пока сохраняется направление фича→фундамент.
Настоящие frozen-зоны фича корректно обходит. Бэкенд-зависимостей нет (чистый FE).

## 9. Вне объёма (YAGNI)

- Кнопка «скопировать ссылку на вид» — URL обновляется сам, копируется из адресной строки.
- Сохранение позиции **между** 2D и 3D (нет осмысленного отображения pan/zoom ↔ орбита).
- Живая синхронизация камеры с back/forward (popstate).
- Анимированный «полёт» к восстановленному виду (restore мгновенный).
- `nuqs` / стейт-либа.

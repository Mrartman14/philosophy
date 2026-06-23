# Видео Picture-in-Picture (Phase 2)

**Дата:** 2026-06-23
**Статус:** дизайн утверждён, готов к плану
**Фича:** `src/features/media` + одна общая иконка в `src/assets/icons` (не frozen-зоны)
**Бекенд:** не требуется (чистый клиентский нативный API)

## Цель

К существующему `<video>` на `/media/[id]` ([media-player.tsx](../../../src/features/media/ui/media-player.tsx))
добавить нативный **Picture-in-Picture**: кнопка → видео уезжает в плавающее окно
поверх ОС. Окно переживает сворачивание браузера, переключение вкладок и уход в
другое приложение (на iOS — и уход из самого приложения). Это и есть «маленькое
окошко в углу при сворачивании».

Phase 2 — НЕ новый плеер. Существующий нативный `<video controls>` остаётся;
PiP — нативная способность, которую мы к нему включаем.

## Принцип

Строго **прогрессивное улучшение**:

- Нет поддержки PiP → кнопка не рендерится, плеер работает как сейчас.
- Видео-only: у `<audio>` PiP нет (нечего показывать) — аудио-ветка не трогается.
- Ноль бекенда, ноль frozen-зон, ноль новых зависимостей.
- Kit-совместимость (Guardrail 7/8): кнопка — `IconButton` из `ui/`; SVG-иконка
  не интерактивна, живёт в общем `src/assets/icons/` (как `ChevronIcon`).

## Кросс-браузерность (Chrome ≡ Safari — обязательное требование)

Два разных API; без обоих паритета НЕ будет:

| API | Где | Методы / события |
| --- | --- | --- |
| **Стандартный** | Chrome, Edge, десктоп-Safari | `video.requestPictureInPicture()`, `document.exitPictureInPicture()`, `document.pictureInPictureEnabled`, `document.pictureInPictureElement`, `video.disablePictureInPicture`; события `enterpictureinpicture` / `leavepictureinpicture` |
| **WebKit-fallback** | **iOS Safari** (на iPhone стандартного API нет!), старый Safari | `video.webkitSetPresentationMode("picture-in-picture" \| "inline")`, `video.webkitSupportsPresentationMode("picture-in-picture")`, `video.webkitPresentationMode`; событие `webkitpresentationmodechanged` |

WebKit-fallback — это и есть то, что даёт «видео продолжает играть, когда ушёл из
приложения» на iOS. Хук выбирает доступный API, отслеживает активность и тоглит
вход/выход. Без обоих → `supported = false`, кнопки нет.

`toggle()` вызывается с клика по кнопке (user-gesture) → разрешено в обоих
браузерах, никакого autoplay-блока.

## Объём

**В Phase 2 входит:**

- Хук `usePictureInPicture(videoRef)` (стандарт + webkit, детект/состояние/toggle).
- Кнопка `PipButton` (kit `IconButton` + общая PiP-иконка), видео-only,
  рендерится только при поддержке.
- Проводка в `MediaPlayer` (ветка `type === "video"`).
- i18n-ключи `pipEnter` / `pipExit` (ru + en).
- Общая иконка `PictureInPictureIcon` в `src/assets/icons/`.

**НЕ входит (граница / follow-up):**

- **PiP-окно при SPA-навигации внутри приложения.** При уходе со страницы
  `<video>` размонтируется → PiP-окно закрывается (окно привязано к элементу).
  Сохранить и это = персистентный элемент в layout (та же сложность, что у
  аудио-бара) → отдельная фича, не v1.
- Аудио-бар «слушать, листая сайт» — отдельная отложенная фича.
- Документ-PiP (`documentPictureInPicture`) — экспериментальный, не нужен.

## Архитектура

### 1. `usePictureInPicture(videoRef)`

Файл: `src/features/media/ui/use-picture-in-picture.ts`

Сигнатура: `(videoRef: RefObject<HTMLMediaElement | null>) => { supported: boolean; active: boolean; toggle: () => void }`.

- **Узкий webkit-тип** (lib.dom их не знает) — локальный интерфейс в файле, без
  глобальных дефинишенов:

  ```ts
  interface WebkitVideo {
    webkitSupportsPresentationMode?: (mode: string) => boolean;
    webkitSetPresentationMode?: (mode: string) => void;
    webkitPresentationMode?: string;
  }
  ```

- **supported** (вычисляется в `useEffect` после маунта, в состоянии — т.к.
  зависит от DOM/наличия API): стандартный путь —
  `typeof document !== "undefined" && document.pictureInPictureEnabled && !el.disablePictureInPicture`;
  webkit-путь — `typeof w.webkitSupportsPresentationMode === "function" && w.webkitSupportsPresentationMode("picture-in-picture")`.
  `supported = standard || webkit`.

- **active**: стандарт — `document.pictureInPictureElement === el`; webkit —
  `w.webkitPresentationMode === "picture-in-picture"`. Подписка на
  `enterpictureinpicture`/`leavepictureinpicture` (на элементе) и
  `webkitpresentationmodechanged`; пересчёт `active` в обработчиках.

- **toggle()**:
  - вход (`!active`): стандарт → `el.requestPictureInPicture().catch(() => { /* отказ — игнор */ })` (как идиома `use-register-sw.ts:66`, без `void`); иначе webkit → `w.webkitSetPresentationMode("picture-in-picture")`.
  - выход (`active`): стандарт (`document.pictureInPictureElement`) → `document.exitPictureInPicture().catch(() => { /* игнор */ })`; иначе webkit → `w.webkitSetPresentationMode("inline")`.

- **Cleanup**: снять все слушатели на unmount.

### 2. `PipButton({ videoRef })`

Файл: `src/features/media/ui/pip-button.tsx` (client).

- Вызывает `usePictureInPicture(videoRef)`.
- Если `!supported` → `return null`.
- Иначе — kit `IconButton` (`tone="neutral"`, `compact`) с
  `<PictureInPictureIcon />`, `onClick={toggle}`.
- `aria-label` по `active`: `t("pipExit")` если активно, иначе `t("pipEnter")`.

### 3. `PictureInPictureIcon`

Файл: `src/assets/icons/picture-in-picture-icon.tsx`

По конвенции `chevron-icon.tsx`: `export function PictureInPictureIcon(props: React.ComponentProps<"svg">)`,
SVG `viewBox="0 0 24 24" width="1em" height="1em" aria-hidden`, `currentColor`.
Глиф: внешний прямоугольник + малый прямоугольник в нижнем-правом углу
(стандартный PiP-символ).

### 4. `MediaPlayer` (правка)

Файл: `src/features/media/ui/media-player.tsx`

- В ветке `type === "video"`: под `<video>` добавить ряд (`Inline` из kit) с
  `<PipButton videoRef={ref} />`. Переиспользуется тот же callback-ref, что уже
  стоит на `<video>` (Phase 1). Аудио-ветка не меняется.

### 5. i18n

Файлы: `src/i18n/messages/ru/media.ts`, `src/i18n/messages/en/media.ts`

Добавить (паритет обязателен): `pipEnter` («Картинка в картинке» / "Picture in
picture"), `pipExit` («Выйти из картинки в картинке» / "Exit picture in
picture").

## Граничные случаи

- **Нет PiP (Firefox использует свой UI; старые браузеры):** `supported=false`,
  кнопки нет, плеер как сейчас.
- **Пользователь закрыл PiP из самого окна:** событие `leavepictureinpicture` /
  `webkitpresentationmodechanged` → `active` синхронизируется.
- **`requestPictureInPicture()` отклонён** (нет метаданных видео / запрет): `.catch`
  гасит, без unhandled rejection.
- **Уход со страницы в PiP:** элемент размонтируется, браузер закрывает окно — за
  пределами v1 (см. «Объём»).
- **Аудио:** PiP-кнопка не рендерится (видео-only).

## Тестирование

Vitest (jsdom), по паттерну `src/features/media/ui/*.test.tsx`.

- **`use-picture-in-picture.test.tsx`** (фейк-video с обоими наборами API + моки
  `document.pictureInPictureEnabled`/`pictureInPictureElement`/`exitPictureInPicture`):
  - `supported`: только стандарт → true; только webkit → true; ни одного → false;
  - `toggle` вход/выход зовёт правильный API в каждом режиме (стандарт vs webkit);
  - `active` обновляется по `enter/leavepictureinpicture` и
    `webkitpresentationmodechanged`;
  - cleanup снимает слушатели;
  - отклонение промиса не роняет (no unhandled rejection).
- **`pip-button.test.tsx`**:
  - рендерится при `supported`, `null` при `!supported`;
  - клик зовёт `toggle`;
  - `aria-label` переключается по `active`.
- **`picture-in-picture-icon.test.tsx`** (по образцу `chevron-icon.test.tsx`):
  рендерит `<svg>` с `aria-hidden`.

Зелёными перед PR: `pnpm lint && pnpm test && pnpm build`.

## Бек-аски

Нет. Фича целиком клиентская на нативном API.

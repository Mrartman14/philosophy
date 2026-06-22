# mediaSession для медиа-плеера (Phase 1)

**Дата:** 2026-06-22
**Статус:** дизайн утверждён, готов к плану
**Фича:** `src/features/media` (не frozen-зона)
**Бекенд:** не требуется (см. «Бек-аски» — список улучшений на потом)

## Цель

Превратить «голый» нативный `<audio>`/`<video>` на странице `/media/[id]` в
источник, управляемый из ОС: lock-screen, шторка уведомлений, кнопки гарнитуры,
медиа-клавиши. Сейчас плеер ([media-player.tsx](../../../src/features/media/ui/media-player.tsx))
не отдаёт системе ни метаданных, ни обработчиков — ОС показывает в лучшем случае
«играет звук с этой вкладки» без названия, обложки и управления.

Реально слушают аудио-лекции (подтверждено пользователем), поэтому управление с
локскрина/наушников окупается.

## Принцип

Строго **прогрессивное улучшение**:

- Всё под feature-detect `"mediaSession" in navigator`. Нет API → плеер работает
  ровно как сейчас, без ошибок.
- Никакого вмешательства в UI-kit: native `controls` у `<audio>`/`<video>`
  остаются (Guardrail 7 не затрагивается — новые интерактивные теги не вводятся).
- Ноль бекенда. `duration`/`currentTime` берутся из самого элемента. Resume —
  временно в `localStorage`.

## Объём

**В Phase 1 входит:**

- `navigator.mediaSession.metadata` (title / artist / artwork).
- Обработчики действий: `play`, `pause`, `seekbackward` (−10с), `seekforward`
  (+10с), `seekto`.
- `playbackState` (`playing` / `paused`).
- `setPositionState` (прогресс в системном UI).
- Resume позиции воспроизведения через `localStorage` (тихо, без UI).

**НЕ входит (отдельные фазы / решения):**

- Персистентный мини-плеер, переживающий навигацию (касается root layout →
  отдельный foundation-PR). Сейчас при уходе со страницы воспроизведение
  прерывается — как и сегодня.
- `previoustrack` / `nexttrack` — в модели данных нет очереди/плейлиста
  (медиа — плоская библиотека, каждый файл на своей `/media/[id]`). Источник
  очереди — отдельное решение.
- Синхронизация позиции воспроизведения между устройствами (нужен бекенд, см.
  «Бек-аски»).
- View Transitions — отдельная сессия по решению пользователя.

## Архитектура

Два изолированных клиентских хука + тонкая правка плеера. Хуки кладём **внутрь
фичи** (`src/features/media/ui/`), потому что общая инфраструктура `src/hooks/*`
заморожена, а это медиа-специфичная логика.

### 1. `useMediaSession(elementRef, meta)`

Файл: `src/features/media/ui/use-media-session.ts`

Привязывается к `RefObject<HTMLMediaElement>` (общий тип для `<audio>` и
`<video>`). Сигнатура `meta`: `{ title: string; artist: string }`.

`artist` приходит готовой строкой от вызывающего (`MediaPlayer`), а не
вычисляется в хуке — хук остаётся чистой обёрткой над API без зависимостей от
i18n.

Поведение (всё внутри `useEffect`, под `"mediaSession" in navigator`):

- **Метаданные:**

  ```ts
  navigator.mediaSession.metadata = new MediaMetadata({
    title,                       // filename без расширения
    artist,                      // название приложения (i18n)
    artwork: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  });
  ```

  Artwork из манифеста — чтобы локскрин аудио не был пустым.

- **Обработчики действий** (`setActionHandler`):
  - `play` → `el.play()`
  - `pause` → `el.pause()`
  - `seekbackward` → `el.currentTime = max(0, el.currentTime − (details.seekOffset ?? 10))`
  - `seekforward` → `el.currentTime = min(duration, el.currentTime + (details.seekOffset ?? 10))`
  - `seekto` → если `details.fastSeek && "fastSeek" in el` → `el.fastSeek(details.seekTime)`, иначе `el.currentTime = details.seekTime`
  - `previoustrack` / `nexttrack` — **не регистрируем** (ОС скрывает кнопки без хендлера).

- **playbackState:** на событиях `play`/`pause` элемента выставляем
  `navigator.mediaSession.playbackState`.

- **Позиция:** на `loadedmetadata` / `timeupdate` / `ratechange` вызываем
  `setPositionState`, **только** если `duration` конечен и > 0 (guard на `NaN` /
  `Infinity` для стримов) и `position ≤ duration`. Обёрнуто в `try/catch` —
  часть браузеров кидает на невалидных значениях.

- **Cleanup (на unmount / смене ref):** снимаем все зарегистрированные хендлеры
  (`setActionHandler(type, null)`), сбрасываем `metadata = null` и
  `playbackState = "none"`, чтобы не оставлять «висящих» обработчиков от
  размонтированного элемента.

### 2. `useResumePlayback(elementRef, mediaId)`

Файл: `src/features/media/ui/use-resume-playback.ts`

localStorage-based возобновление (временный стопгап — бек не хранит позицию).

- Ключ: `media-resume:<mediaId>`.
- На `loadedmetadata`: читаем сохранённую позицию; применяем `currentTime` только
  если она `> 5с` и `< duration − 5с` (не «перематывать» почти-в-начале и не
  возобновлять у самого конца).
- На `timeupdate` (троттл ~5с между записями): сохраняем `currentTime`.
- На `ended`: удаляем ключ.
- Весь доступ к `localStorage` — под `try/catch` (приватный режим, квота,
  выключенное хранилище). Без визуального UI: возобновление тихое.

### 3. Правка `MediaPlayer`

Файл: `src/features/media/ui/media-player.tsx`

- Добавить `useRef<HTMLMediaElement>` и повесить `ref` на `<audio>` и `<video>`.
- Принять новый проп `mediaId: string`.
- Вызвать `useMediaSession(ref, { title: stripExt(filename), artist: <app name из i18n> })`
  и `useResumePlayback(ref, mediaId)`.
- Native `controls` и текущая разметка сохраняются без изменений.

Файл: `src/features/media/ui/media-detail.tsx`

- Прокинуть `mediaId={media.id}` в `<MediaPlayer>` (там `media.id` уже есть).

## Граничные случаи

- **Нет mediaSession (Safari старый / нестандарт):** хук — no-op, плеер как
  сейчас.
- **`<video>`:** mediaSession работает и для видео (системные контролы поверх).
  Обрабатываем оба типа одинаково — хуки на `HTMLMediaElement`.
- **Стрим без конечной длительности:** `setPositionState` пропускаем (guard).
- **localStorage недоступен:** resume молча отключается, остальное работает.
- **Размонтирование при навигации:** элемент уходит, воспроизведение прерывается
  (ожидаемо для Phase 1), cleanup снимает хендлеры.
- **Приватное медиа (signed URL):** в localStorage хранится только число
  (позиция) по `mediaId` — никакого контента, утечки нет.

## Тестирование

Vitest, по паттерну существующих `src/features/media/ui/*.test.tsx`.

- **`use-media-session.test.tsx`** (с моками `navigator.mediaSession` и фейковым
  media-элементом):
  - хендлеры регистрируются при наличии API; `previoustrack`/`nexttrack` — нет;
  - математика `seekbackward`/`seekforward` (клампы 0 и duration);
  - `seekto` с/без `fastSeek`;
  - `setPositionState` пропускается при `Infinity`/`NaN` duration;
  - `playbackState` меняется на `play`/`pause`;
  - cleanup снимает хендлеры и сбрасывает metadata;
  - отсутствие `mediaSession` → no-op без ошибок.
- **`use-resume-playback.test.tsx`** (мок `localStorage` + фейк-элемент):
  - чтение/применение позиции на `loadedmetadata` (с порогами 5с);
  - запись с троттлингом на `timeupdate`;
  - очистка на `ended`;
  - недоступный `localStorage` → тихий no-op.

Зелёными перед PR: `pnpm lint && pnpm test && pnpm build`.

## Бек-аски (флаг корня, AGENTS.md)

Контракт `media.Media` тонкий для медиа-плеера. Phase 1 работает без этого, но
для полноты фичи бек мог бы отдать:

1. **`title`** — человекочитаемое название отдельно от `filename`. Сейчас в
   metadata идёт `filename` без расширения; для загруженного файла это может быть
   «lecture-3-final.mp3», а не «Хайдеггер. Бытие и время».
2. **`poster` / `artwork`** — обложка медиа для локскрина (сейчас — общая иконка
   приложения из манифеста как фолбэк).
3. **Позиция воспроизведения** (resume) — эндпоинт чтения/записи позиции, чтобы
   возобновление синхронизировалось между устройствами. Сейчас FE держит её в
   `localStorage` как временный стопгап — **убрать**, когда бек даст контракт.

Когда корень починен — снять соответствующие FE-обходы.

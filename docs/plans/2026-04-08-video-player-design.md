# Дизайн: кастомный видеоплеер

## Что

Кастомный видеоплеер со своими контролами, поддержкой нативных API (fullscreen, PiP, MediaSession), регулировкой скорости, промоткой, интервалами (главами) и тэгами (засечками) на таймлайне.

## Зачем

Нативный `<video controls>` не позволяет отображать главы и засечки на таймлайне, регулировать скорость ползунком, и визуально не вписывается в палитру проекта.

## Подход

Кастомный компонент на Base UI. Библиотеки (Vidstack, Plyr) отвергнуты: тяжёлый бандл, лишние абстракции (HLS/DASH не нужны), а кастомные фичи (интервалы, засечки, ползунок скорости) всё равно пришлось бы писать руками.

Base UI даёт `Slider`, `Toolbar`, `Toggle`, `Popover` с accessibility (ARIA, keyboard) без визуального багажа. Нативные API (Fullscreen, PiP, MediaSession) тривиальны — 5-15 строк каждый.

## Архитектура компонентов

```
<VideoPlayer>                          — client component, главный контейнер
├── <video> (ref)                      — нативный элемент, скрытые нативные controls
├── <VideoOverlay>                     — клик/тап по видео = play/pause
├── <PlayerControls>                   — панель контролов (Toolbar из Base UI)
│   ├── <PlayButton>                   — Toggle из Base UI
│   ├── <SkipButtons>                  — |◁  ◁10s  ▷10s  ▷|
│   ├── <TimeDisplay>                  — текущее время / длительность
│   ├── <Timeline>                     — Slider из Base UI
│   │   ├── интервалы (цветные секции на треке)
│   │   ├── тэги-засечки (маркеры на треке)
│   │   └── <TimelineTooltip>          — время + название главы при ховере
│   ├── <SpeedSlider>                  — Slider 0.5–2x со снапами, лейбл-сброс на 1x
│   ├── <VolumeControl>               — иконка (клик=mute) + Slider
│   ├── <PipButton>                    — Toggle, Picture-in-Picture API
│   └── <FullscreenButton>            — Toggle, Fullscreen API
└── <CollapseButton>                   — свернуть контролы в «пилюлю»
```

## Props API

```typescript
// Props
interface VideoPlayerProps {
  src: string;
  chapters?: Chapter[];
  markers?: Marker[];
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

// Imperative handle (через forwardRef + useImperativeHandle)
interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface Chapter {
  title: string;
  startTime: number; // секунды
  endTime: number;
}

interface Marker {
  time: number; // секунды
  label: string;
  content?: ReactNode; // интерактивный контент поповера
}
```

### Интеграция с текущим кодом

- `LectureSync` заменит `<video controls>` на `<VideoPlayer>`, передаст `onTimeUpdate` для синхронизации с `TranscriptHighlighter`
- `seekTo` вызывается через ref: `playerRef.current?.seekTo(time)` — для перемотки из транскрипта
- `chapters` и `markers` — из Go API (когда будут готовы), пока пустые массивы

## Таймлайн

### Интервалы (главы)

- Таймлайн-слайдер (Base UI `Slider`) визуально разделён на цветные секции
- Ширина секции пропорциональна `(endTime - startTime) / duration`
- Между секциями — разделитель 2px цвета `--color-border`
- Ховер над секцией — тултип с таймкодом и `chapter.title`

### Засечки (тэги)

- Абсолютное позиционирование на треке: `left: (marker.time / duration) * 100%`
- Визуально — вертикальная чёрточка 3-4px цвета `--color-primary`
- Ховер — поповер (Base UI `Popover` с `openOnHover`) с `marker.label` и `marker.content`
- Поповер остаётся пока курсор на маркере или на самом поповере

### Буферизация

- Вторичная полупрозрачная полоса показывает `buffered` ranges

## Управление

### Кнопки контролов

```
[|◁] [◁10] [▶/❚❚] [10▷] [▷|]   00:00/00:00   [═══Timeline═══]   [0.5x──●──2x] 1.2x   [🔊━━━] [PiP] [⛶] [▼]
```

- `|◁` / `▷|` — перейти к предыдущему/следующему сегменту (интервалу)
- `◁10` / `10▷` — перемотка ±10 секунд
- `▶/❚❚` — play/pause
- `[▼]` — свернуть контролы

### Клавиатурные шорткаты

| Клавиша | Действие |
|---------|----------|
| Space / K | Play/Pause |
| ← / → | ±10 секунд |
| ↑ / ↓ | Громкость ±5% |
| M | Mute/Unmute |
| F | Fullscreen toggle |
| P | PiP toggle |
| < / > | Скорость ±0.25 |

### Скорость воспроизведения

- Ползунок (Base UI `Slider`) от 0.5x до 2x, `step={0.05}`
- Магнитные точки на 0.5, 1, 1.25, 1.5, 2 — snap в `onValueChange` (±0.05 → округление)
- Base UI Slider не имеет встроенных snap points — реализуем в колбэке
- Клик по лейблу скорости — сброс на 1x

### Скрытие/показ контролов

- По умолчанию — видимы под видео
- Кнопка `[▼]` — сворачивает в «пилюлю» (иконка play + время) в правом нижнем углу
- Ховер/тап по видео или пилюле — контролы разворачиваются
- Анимация — `framer-motion`

### Нативные API

- **Fullscreen:** `element.requestFullscreen()` / `document.exitFullscreen()`
- **PiP:** `video.requestPictureInPicture()` / `document.exitPictureInPicture()`
- **MediaSession:** `navigator.mediaSession.metadata` (title лекции), `setActionHandler` для play/pause/seekforward/seekbackward

## Файловая структура

```
src/components/app/video-player/
├── video-player.tsx          — главный компонент
├── player-controls.tsx       — панель контролов (Toolbar)
├── timeline.tsx              — слайдер с интервалами, засечками, тултипом
├── speed-slider.tsx          — ползунок скорости со снапами
├── volume-control.tsx        — иконка + слайдер громкости
└── use-video-player.ts       — хук: состояние, keyboard, fullscreen, pip, media session
```

## Стилизация

- Tailwind CSS с CSS-переменными проекта: `--color-primary`, `--color-border`, `--color-background`, `--color-description`, `--color-text-pane`
- Тёмная/светлая тема — автоматически через `color-scheme: light dark`
- Никакого дополнительного CSS, только Tailwind utility classes

## Адаптивность

- Мобильный: скорость и громкость за иконками-кнопками (попап по тапу)
- Клавиатурные шорткаты — только десктоп (по `hover` media query)
- Одинарный тап по видео = play/pause (без двойных тапов для перемотки)

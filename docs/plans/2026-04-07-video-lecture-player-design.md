# Video Lecture Player — Design

## Overview

Отдельная страница (`/video`) для просмотра видео лекции с синхронизированной транскрипцией и визуализацией состояния доски (mermaid-диаграммы).

Пробные данные: `public/cutted.mp4` (видео) + `public/cutted.json` (транскрипция и состояния доски).

## Data Model

```ts
type TranscriptItem = {
  id: number
  start: number  // секунды
  end: number
  speaker: string
  text: string
}

type BoardState = {
  id: number
  start: number
  end: number
  description: string
  mermaid: string  // mermaid-код диаграммы, пустая строка = чистая доска
}

type VideoLectureData = {
  transcript: TranscriptItem[]
  board_states: BoardState[]
}
```

## Architecture

### Routing

Отдельный роут: `src/app/video/page.tsx`. Пока не привязан к лекциям — работает только с `cutted.json` и `cutted.mp4`.

### Hook: `useSyncedPlayer`

```ts
useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement>,
  data: VideoLectureData
) => {
  currentTranscriptId: number | null
  currentBoardState: BoardState | null
  seekTo: (time: number) => void
}
```

- Подписывается на `timeupdate` видеоэлемента
- Находит transcript/board_state по `currentTime ∈ [start, end]`
- `seekTo` — устанавливает `videoRef.current.currentTime`

### Synchronization

**Видео → UI:** `timeupdate` (~4 раза/сек) обновляет `currentTranscriptId` и `currentBoardState`.

**UI → Видео:** клик на фразу вызывает `seekTo(item.start)`, что триггерит обновление доски и подсветки через тот же `timeupdate`.

## Layout

### Desktop
```
┌───────────────────┬──────────────────────┐
│ Транскрипция      │ sticky: Видео (16:9) │
│ (скролл)          │                      │
│ > Фраза 1 (акт.) │ ┌──────────────────┐ │
│   Фраза 2         │ │ Mermaid доска    │ │
│   Фраза 3         │ │                  │ │
│   ...             │ └──────────────────┘ │
└───────────────────┴──────────────────────┘
```

### Mobile
Стэк: Видео → Доска → Транскрипция (вертикально).

## Components

1. **`VideoLecturePage`** (`src/app/video/page.tsx`) — загружает JSON, создаёт videoRef, вызывает useSyncedPlayer, рендерит layout
2. **`TranscriptPanel`** — список фраз, подсветка активной, автоскролл (`scrollIntoView`), клик → seekTo
3. **`BoardPanel`** — рендерит mermaid через `mermaid.render()`, обновляется при смене boardState
4. **`VideoPlayer`** — обёртка над `<video>` с ref forwarding

## Mermaid Rendering

- Динамический импорт: `import('mermaid')` для code-splitting (~200KB не в основном бандле)
- При смене `boardState.mermaid` — вызов `mermaid.render()` с новым кодом
- Пустая строка mermaid → показываем description или пустой контейнер

## Dependencies

- `mermaid` — новая зависимость для рендеринга диаграмм

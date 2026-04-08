# Server-First Refactor — максимизация серверного рендеринга

**Дата:** 2026-04-08
**Статус:** Утверждён

## Контекст

Проект уже использует SSR (Next.js 16, React 19). Данные загружаются на сервере (`getLectures`, `getLectureById`, `getTranscript`). Но ряд компонентов помечен `"use client"` шире, чем необходимо — на клиент отправляется больше JS и HTML-гидратации, чем требуется для интерактивности.

**Цели:**
- Минимизировать клиентский JS-бандл
- Ускорить FCP/LCP за счёт серверного HTML
- Архитектурный принцип: клиент делает только то, что не может сервер

## 1. Удаление мёртвого кода

Два компонента не импортируются ни в одном файле:

- `src/components/shared/scroll-button.tsx` — `ScrollButton`
- `src/components/shared/popup/popup.tsx` — `Popup`

**Действие:** Удалить файлы и директорию `popup/`.

## 2. `offline/page.tsx` → серверный компонент

`src/app/offline/page.tsx` помечен `"use client"` только из-за импорта `GoBack`. Но `GoBack` — уже клиентский компонент, и Next.js позволяет импортировать клиентские компоненты из серверных.

**Действие:** Убрать `"use client"` из `offline/page.tsx`. Компонент становится серверным, `GoBack` остаётся клиентским островом.

## 3. Декомпозиция LecturePlayer

### Проблема

Сейчас `src/app/lectures/[id]/lecture-player.tsx` — монолитный клиентский компонент. Содержит:
- Layout (CSS grid)
- Заголовок и описание лекции (статика)
- Элемент `<video>`
- Весь список сегментов транскрипта (может быть сотни элементов)
- Логику синхронизации видео ↔ транскрипт

Весь этот HTML гидратируется на клиенте, хотя интерактивны только: (a) связь timeupdate → подсветка сегмента, (b) клик по сегменту → seek видео, (c) auto-scroll к активному сегменту.

### Новая архитектура

```
lectures/[id]/page.tsx (server) — layout, статика
├── <LectureSync>                    ← client: тонкий wrapper, держит state
│   ├── <video>                      ← рендерится внутри client, ref нужен
│   ├── title, description           ← передаются как children (server-rendered)
│   └── <TranscriptHighlighter>      ← client: подсветка + scroll + click delegation
│       └── {children}               ← server-rendered HTML сегментов
```

### Компоненты

**`page.tsx` (server)** — уже серверный. Берёт на себя:
- Fetch данных (уже делает)
- Рендер статического HTML сегментов транскрипта как children
- Передачу данных в клиентские острова

**`lecture-sync.tsx` (client)** — тонкий компонент:
- `useRef<HTMLVideoElement>` + `useSyncedPlayer` → `currentSegmentId`, `seekTo`
- Рендерит `<video>` (нужен ref)
- Передаёт `currentSegmentId` и `seekTo` в `TranscriptHighlighter`
- Заголовок и описание лекции передаются как `children` (server-rendered)

**`transcript-highlighter.tsx` (client)** — тонкий компонент:
- Принимает `currentSegmentId`, `onSeek`, `children`
- Через DOM (`data-segment-id`) добавляет/убирает CSS-класс активного сегмента
- `scrollIntoView({ behavior: "smooth", block: "center" })` для активного
- Один `onClick` делегирован на контейнер, читает `data-start` из target

**`transcript-panel.tsx`** — становится серверным (убрать `"use client"`):
- Рендерит `<button>` для каждого сегмента с `data-segment-id={id}` и `data-start={start}`
- Стили: базовый класс, без подсветки (подсветка добавляется клиентским highlighter через DOM)

### Выигрыш

- HTML транскрипта (основной объём) рендерится сервером
- Клиентский JS содержит только: `useSyncedPlayer` hook + DOM-манипуляции подсветки
- Сегменты не проходят через React reconciliation на клиенте

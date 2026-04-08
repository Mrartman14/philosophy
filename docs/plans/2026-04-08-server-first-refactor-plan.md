# Server-First Refactor — План реализации

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Максимизировать серверный рендеринг — убрать лишний `"use client"`, удалить мёртвый код, декомпозировать LecturePlayer на серверную оболочку + клиентские острова.

**Architecture:** Серверные компоненты рендерят весь статический HTML (layout, транскрипт, метаданные лекции). Клиентский JS содержит только интерактивность: синхронизацию видео с транскриптом (timeupdate → подсветка, клик → seek, auto-scroll). Общий state (`currentSegmentId`, `seekTo`) живёт в тонком клиентском wrapper.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind v4

**Тестовый фреймворк:** Отсутствует. Верификация — `npx tsc --noEmit` и `npm run build`.

---

### Task 1: Удалить мёртвый код — ScrollButton

**Files:**
- Delete: `src/components/shared/scroll-button.tsx`

**Step 1: Убедиться, что компонент не импортируется**

Run: `grep -rn "scroll-button\|ScrollButton" src/`
Expected: Только определение в `scroll-button.tsx`, никаких импортов.

**Step 2: Удалить файл**

```bash
rm src/components/shared/scroll-button.tsx
```

**Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 4: Commit**

```bash
git rm src/components/shared/scroll-button.tsx
git commit -m "refactor: remove unused ScrollButton component"
```

---

### Task 2: Удалить мёртвый код — Popup

**Files:**
- Delete: `src/components/shared/popup/popup.tsx`
- Delete: `src/components/shared/popup/` (директория)

**Step 1: Убедиться, что компонент не импортируется**

Run: `grep -rn "popup\|Popup" src/ --include="*.tsx" --include="*.ts"`
Expected: Только определение в `popup.tsx`, никаких импортов.

**Step 2: Удалить файлы**

```bash
rm -rf src/components/shared/popup
```

**Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 4: Commit**

```bash
git rm -r src/components/shared/popup
git commit -m "refactor: remove unused Popup component"
```

---

### Task 3: `offline/page.tsx` → серверный компонент

**Files:**
- Modify: `src/app/offline/page.tsx`

**Step 1: Убрать `"use client"`**

Удалить строку 1 (`"use client";`) из файла. `GoBack` — уже клиентский компонент, Next.js корректно рендерит его как клиентский остров внутри серверного родителя.

**Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 3: Проверить сборку**

Run: `npm run build`
Expected: Успешная сборка

**Step 4: Commit**

```bash
git add src/app/offline/page.tsx
git commit -m "refactor: make offline page a server component"
```

---

### Task 4: Создать `transcript-highlighter.tsx` — клиентский остров для подсветки

**Files:**
- Create: `src/components/app/video/transcript-highlighter.tsx`

**Step 1: Создать компонент**

```tsx
"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";

interface TranscriptHighlighterProps {
  currentSegmentId: number | null;
  onSeek: (time: number) => void;
}

const ACTIVE_CLASS = "bg-(--color-primary)/10 border-l-2 border-(--color-primary)";
const INACTIVE_HOVER_CLASS = "hover:bg-(--color-border)/30";

export const TranscriptHighlighter: React.FC<
  PropsWithChildren<TranscriptHighlighterProps>
> = ({ currentSegmentId, onSeek, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove previous active styling
    const prev = container.querySelector("[data-active]");
    if (prev) {
      prev.removeAttribute("data-active");
    }

    if (currentSegmentId == null) return;

    // Add active styling
    const next = container.querySelector(
      `[data-segment-id="${currentSegmentId}"]`
    );
    if (next) {
      next.setAttribute("data-active", "");
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSegmentId]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-start]"
    );
    if (!target) return;
    const start = Number(target.dataset.start);
    if (!Number.isNaN(start)) {
      onSeek(start);
    }
  };

  return (
    <div ref={containerRef} onClick={handleClick} className="flex flex-col gap-1 p-4">
      {children}
    </div>
  );
};
```

**Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 3: Commit**

```bash
git add src/components/app/video/transcript-highlighter.tsx
git commit -m "feat: add TranscriptHighlighter client island for transcript sync"
```

---

### Task 5: Переделать `transcript-panel.tsx` в серверный компонент

**Files:**
- Modify: `src/components/app/video/transcript-panel.tsx`

**Step 1: Переписать как серверный компонент**

Убрать `"use client"`, убрать хуки. Рендерить статический HTML с `data-segment-id` и `data-start` атрибутами. Стили подсветки управляются через CSS-атрибут `data-active` (добавляется клиентским `TranscriptHighlighter`).

```tsx
import type { components } from "@/api/schema";

type Segment = components["schemas"]["transcript.Segment"];

interface TranscriptPanelProps {
  segments: Segment[];
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  segments,
}) => {
  return (
    <>
      {segments.map((item) => (
        <button
          key={item.id}
          data-segment-id={item.id}
          data-start={item.start ?? 0}
          className="text-left p-2 rounded-lg transition-colors cursor-pointer hover:bg-(--color-border)/30 data-[active]:bg-(--color-primary)/10 data-[active]:border-l-2 data-[active]:border-(--color-primary) data-[active]:hover:bg-(--color-primary)/10"
        >
          <span className="text-xs text-(--color-description) block">
            {item.speaker}
          </span>
          <span className="text-sm">{item.text}</span>
        </button>
      ))}
    </>
  );
};
```

**Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 3: Commit**

```bash
git add src/components/app/video/transcript-panel.tsx
git commit -m "refactor: make TranscriptPanel a server component with data attributes"
```

---

### Task 6: Переделать `lecture-player.tsx` в `lecture-sync.tsx` — тонкий клиентский wrapper

**Files:**
- Delete: `src/app/lectures/[id]/lecture-player.tsx`
- Create: `src/app/lectures/[id]/lecture-sync.tsx`

**Step 1: Создать `lecture-sync.tsx`**

Тонкий клиентский компонент: держит videoRef + useSyncedPlayer, рендерит `<video>`, пробрасывает state в TranscriptHighlighter. Серверный контент (транскрипт) приходит как `transcriptContent` (ReactNode).

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import type { components } from "@/api/schema";
import { useSyncedPlayer } from "@/hooks/use-synced-player";
import { TranscriptHighlighter } from "@/components/app/video/transcript-highlighter";

type Segment = components["schemas"]["transcript.Segment"];

interface LectureSyncProps {
  videoUrl: string | undefined;
  segments: Segment[];
  transcriptContent: ReactNode;
  infoContent: ReactNode;
}

export const LectureSync: React.FC<LectureSyncProps> = ({
  videoUrl,
  segments,
  transcriptContent,
  infoContent,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentSegmentId, seekTo } = useSyncedPlayer(videoRef, segments);

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptHighlighter
          currentSegmentId={currentSegmentId}
          onSeek={seekTo}
        >
          {transcriptContent}
        </TranscriptHighlighter>
      </div>
      <div className="order-1 md:order-2 md:sticky md:top-(--header-height) md:h-[calc(100vh-var(--header-height))] md:overflow-y-auto border-l border-(--color-border)">
        {videoUrl ? (
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video"
            src={videoUrl}
            preload="metadata"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-(--color-text-pane) text-(--color-description)">
            Видео недоступно
          </div>
        )}
        {infoContent}
      </div>
    </div>
  );
};
```

**Step 2: Удалить старый `lecture-player.tsx`**

```bash
rm src/app/lectures/[id]/lecture-player.tsx
```

**Step 3: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: Ошибка в `page.tsx` — импорт `LecturePlayer` не найден (ожидаемо, исправим в Task 7)

**Step 4: Commit**

```bash
git add src/app/lectures/[id]/lecture-sync.tsx
git rm src/app/lectures/[id]/lecture-player.tsx
git commit -m "refactor: replace LecturePlayer with thin LectureSync client wrapper"
```

---

### Task 7: Обновить `page.tsx` — серверный layout с клиентскими островами

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`

**Step 1: Обновить page.tsx**

Серверный компонент рендерит статический HTML (заголовок, описание, сегменты транскрипта) и передаёт его в `LectureSync` через props-слоты.

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLectureById, getLectures, getTranscript } from "@/api/lecture-api";
import { LectureSync } from "./lecture-sync";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";

interface LecturePageParams {
  id: string;
}

export async function generateStaticParams(): Promise<LecturePageParams[]> {
  const result = await getLectures(1, 100);
  return (result.data ?? [])
    .filter((lecture): lecture is typeof lecture & { id: string } => !!lecture.id)
    .map((lecture) => ({ id: lecture.id }));
}

type GenerateMetadataProps = {
  params: Promise<LecturePageParams>;
};
export async function generateMetadata({
  params,
}: GenerateMetadataProps): Promise<Metadata> {
  const { id } = await params;
  const lecture = await getLectureById(id);
  return { title: lecture.title };
}

interface PageProps {
  params: Promise<LecturePageParams>;
}
export default async function LecturePage({ params }: PageProps) {
  const { id } = await params;

  let lecture, transcript;
  try {
    [lecture, transcript] = await Promise.all([
      getLectureById(id),
      getTranscript(id),
    ]);
  } catch {
    return notFound();
  }

  const segments = transcript.segments ?? [];

  return (
    <LectureSync
      videoUrl={lecture.video_url}
      segments={segments}
      transcriptContent={<TranscriptPanel segments={segments} />}
      infoContent={
        <div className="p-4">
          <h1 className="text-xl font-bold">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-sm text-(--color-description) mt-2">
              {lecture.description}
            </p>
          )}
        </div>
      }
    />
  );
}
```

**Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 3: Проверить сборку**

Run: `npm run build`
Expected: Успешная сборка

**Step 4: Commit**

```bash
git add src/app/lectures/[id]/page.tsx
git commit -m "refactor: wire up server-rendered transcript and info into LectureSync"
```

---

### Task 8: Финальная верификация

**Step 1: Типы**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 2: Линтинг**

Run: `npx next lint`
Expected: 0 ошибок

**Step 3: Сборка**

Run: `npm run build`
Expected: Успешная сборка

**Step 4: Визуальная проверка**

Run: `npm run dev`
Проверить:
- Главная — список лекций
- Страница лекции — видео + транскрипт
- Клик по сегменту — seek видео
- Воспроизведение — автоподсветка текущего сегмента + auto-scroll
- Offline-страница — рендерится, кнопка «Назад» работает

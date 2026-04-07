# Video Lecture Player — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone `/video` page that plays `cutted.mp4` with synchronized transcript and mermaid board visualization.

**Architecture:** Client-side page fetches `cutted.json`, uses `useSyncedPlayer` hook to sync `<video>` timeupdate with transcript highlight/autoscroll and mermaid board state. Layout: transcript scrollable on left, video + board sticky on right (stacked on mobile).

**Tech Stack:** Next.js 16, React 19, Tailwind 4, mermaid (new dep), `<video>` HTML element

---

### Task 1: Install mermaid dependency

**Step 1: Install mermaid**

Run: `npm install mermaid`

**Step 2: Verify installation**

Run: `cat package.json | grep mermaid`
Expected: `"mermaid": "^11..."`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "add mermaid dependency for board visualization"
```

---

### Task 2: Create types and data-fetching utility

**Files:**
- Create: `src/entities/video-lecture.ts`

**Step 1: Create the types file**

```ts
// src/entities/video-lecture.ts

export type TranscriptItem = {
  id: number;
  start: number;
  end: number;
  speaker: string;
  text: string;
};

export type BoardState = {
  id: number;
  start: number;
  end: number;
  description: string;
  mermaid: string;
};

export type VideoLectureData = {
  transcript: TranscriptItem[];
  board_states: BoardState[];
};
```

**Step 2: Commit**

```bash
git add src/entities/video-lecture.ts
git commit -m "add video lecture data types"
```

---

### Task 3: Create `useSyncedPlayer` hook

**Files:**
- Create: `src/components/app/video/use-synced-player.ts`

**Step 1: Implement the hook**

```ts
// src/components/app/video/use-synced-player.ts
"use client";

import { useEffect, useState, useCallback, RefObject } from "react";
import {
  VideoLectureData,
  TranscriptItem,
  BoardState,
} from "@/entities/video-lecture";

function findByTime<T extends { start: number; end: number }>(
  items: T[],
  time: number
): T | null {
  return items.find((item) => time >= item.start && time <= item.end) ?? null;
}

export function useSyncedPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  data: VideoLectureData | null
) {
  const [currentTranscriptId, setCurrentTranscriptId] = useState<number | null>(
    null
  );
  const [currentBoardState, setCurrentBoardState] = useState<BoardState | null>(
    null
  );

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) {
        video.currentTime = time;
      }
    },
    [videoRef]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;

      const transcript = findByTime(data.transcript, time);
      setCurrentTranscriptId(transcript?.id ?? null);

      const board = findByTime(data.board_states, time);
      setCurrentBoardState(board);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [videoRef, data]);

  return { currentTranscriptId, currentBoardState, seekTo };
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `use-synced-player.ts`

**Step 3: Commit**

```bash
git add src/components/app/video/use-synced-player.ts
git commit -m "add useSyncedPlayer hook for video-transcript-board sync"
```

---

### Task 4: Create `BoardPanel` component

**Files:**
- Create: `src/components/app/video/board-panel.tsx`

**Step 1: Implement BoardPanel**

```tsx
// src/components/app/video/board-panel.tsx
"use client";

import { useEffect, useRef, useId } from "react";
import { BoardState } from "@/entities/video-lecture";

interface BoardPanelProps {
  boardState: BoardState | null;
}

export const BoardPanel: React.FC<BoardPanelProps> = ({ boardState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!containerRef.current) return;

    if (!boardState || !boardState.mermaid) {
      containerRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;

    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled || !containerRef.current) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        suppressErrorRendering: true,
      });

      const elementId = `board-${uniqueId}-${boardState.id}`;

      mermaid
        .render(elementId, boardState.mermaid)
        .then(({ svg }) => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        })
        .catch(() => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = `<p class="text-sm text-(--description)">${boardState.description}</p>`;
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [boardState, uniqueId]);

  return (
    <div
      ref={containerRef}
      className="min-h-[100px] flex items-center justify-center p-4"
    />
  );
};
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `board-panel.tsx`

**Step 3: Commit**

```bash
git add src/components/app/video/board-panel.tsx
git commit -m "add BoardPanel component for mermaid board rendering"
```

---

### Task 5: Create `TranscriptPanel` component

**Files:**
- Create: `src/components/app/video/transcript-panel.tsx`

**Step 1: Implement TranscriptPanel**

```tsx
// src/components/app/video/transcript-panel.tsx
"use client";

import { useEffect, useRef } from "react";
import { TranscriptItem } from "@/entities/video-lecture";

interface TranscriptPanelProps {
  transcript: TranscriptItem[];
  currentTranscriptId: number | null;
  onSeek: (time: number) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcript,
  currentTranscriptId,
  onSeek,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTranscriptId]);

  return (
    <div className="flex flex-col gap-1 p-4">
      {transcript.map((item) => {
        const isActive = item.id === currentTranscriptId;
        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(item.start)}
            className={`text-left p-2 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? "bg-(--color-primary)/10 border-l-2 border-(--color-primary)"
                : "hover:bg-(--color-border)/30"
            }`}
          >
            <span className="text-xs text-(--description) block">
              {item.speaker}
            </span>
            <span className="text-sm">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
};
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors related to `transcript-panel.tsx`

**Step 3: Commit**

```bash
git add src/components/app/video/transcript-panel.tsx
git commit -m "add TranscriptPanel component with active highlight and autoscroll"
```

---

### Task 6: Create the `/video` page

**Files:**
- Create: `src/app/video/page.tsx`

**Step 1: Implement the page**

```tsx
// src/app/video/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { VideoLectureData } from "@/entities/video-lecture";
import { useSyncedPlayer } from "@/components/app/video/use-synced-player";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";
import { BoardPanel } from "@/components/app/video/board-panel";

export default function VideoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<VideoLectureData | null>(null);

  useEffect(() => {
    fetch("/cutted.json")
      .then((res) => res.json())
      .then(setData);
  }, []);

  const { currentTranscriptId, currentBoardState, seekTo } = useSyncedPlayer(
    videoRef,
    data
  );

  if (!data) {
    return <div className="p-8 text-center text-(--description)">Загрузка...</div>;
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      {/* Left: Transcript (scrollable) */}
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptPanel
          transcript={data.transcript}
          currentTranscriptId={currentTranscriptId}
          onSeek={seekTo}
        />
      </div>

      {/* Right: Video + Board (sticky) */}
      <div className="order-1 md:order-2 md:sticky md:top-0 md:h-screen md:overflow-y-auto border-l border-(--border)">
        <video
          ref={videoRef}
          controls
          className="w-full aspect-video"
          src="/cutted.mp4"
          preload="metadata"
        />
        <BoardPanel boardState={currentBoardState} />
      </div>
    </div>
  );
}
```

**Step 2: Verify it builds**

Run: `npm run build`
Expected: Build succeeds, `/video` page generated

**Step 3: Manual verification**

Run: `npm run dev`

Open `http://localhost:3001/video` and verify:
1. Video loads and plays
2. Clicking a transcript phrase seeks the video
3. Playing video highlights current phrase and auto-scrolls
4. Mermaid diagrams render and update with video time
5. Layout is transcript-left, video+board-right on desktop

**Step 4: Commit**

```bash
git add src/app/video/page.tsx
git commit -m "add /video page with synced player, transcript, and board"
```

---

### Task 7: Handle `basePath` for static export

The project uses `gh-pages` deployment with a potential `NEXT_PUBLIC_BASE_PATH`. The `<video>` src and `fetch` URL need to account for this.

**Files:**
- Modify: `src/app/video/page.tsx`

**Step 1: Check if basePath is used**

Read `next.config.ts` to see if `basePath` is configured. If so, update the video `src` and fetch URL:

```tsx
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// ...
fetch(`${basePath}/cutted.json`)
// ...
src={`${basePath}/cutted.mp4`}
```

**Step 2: Commit if changes were needed**

```bash
git add src/app/video/page.tsx
git commit -m "fix: account for basePath in video page asset URLs"
```

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Install mermaid | `package.json` |
| 2 | Types | `src/entities/video-lecture.ts` |
| 3 | `useSyncedPlayer` hook | `src/components/app/video/use-synced-player.ts` |
| 4 | `BoardPanel` | `src/components/app/video/board-panel.tsx` |
| 5 | `TranscriptPanel` | `src/components/app/video/transcript-panel.tsx` |
| 6 | `/video` page | `src/app/video/page.tsx` |
| 7 | basePath fix | `src/app/video/page.tsx` |

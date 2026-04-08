# Custom Video Player Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the native `<video controls>` with a custom video player featuring chapters, markers, speed control, keyboard shortcuts, fullscreen, PiP, and MediaSession.

**Architecture:** Single client component `<VideoPlayer>` with internal sub-components. One `useVideoPlayer` hook encapsulates all `<video>` element state and native API integration. Base UI primitives (`Toolbar`, `Slider`, `Toggle`, `Popover`) provide accessible building blocks. Tailwind + project CSS variables for styling.

**Tech Stack:** React 19, Next.js 16, Base UI 1.3+, Framer Motion, Tailwind CSS 4

**Design doc:** `docs/plans/2026-04-08-video-player-design.md`

---

### Task 1: useVideoPlayer hook — core state

**Files:**
- Create: `src/hooks/use-video-player.ts`

**Step 1: Create the hook with core video state**

```typescript
"use client";

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";

interface UseVideoPlayerOptions {
  onTimeUpdate?: (time: number) => void;
}

export function useVideoPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseVideoPlayerOptions = {}
) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      options.onTimeUpdate?.(t);
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onRateChange = () => setPlaybackRate(video.playbackRate);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
    };
  }, [videoRef, options.onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, [videoRef]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
    },
    [videoRef]
  );

  const skipBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
    },
    [videoRef]
  );

  const changeVolume = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (video) {
        video.volume = Math.max(0, Math.min(1, v));
        if (video.muted && v > 0) video.muted = false;
      }
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, [videoRef]);

  const changePlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = Math.max(0.25, Math.min(4, rate));
    },
    [videoRef]
  );

  return {
    playing,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    playbackRate,
    togglePlay,
    seek,
    skipBy,
    changeVolume,
    toggleMute,
    changePlaybackRate,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to `use-video-player.ts`

**Step 3: Commit**

```bash
git add src/hooks/use-video-player.ts
git commit -m "feat(video-player): add useVideoPlayer hook with core state"
```

---

### Task 2: useVideoPlayer hook — fullscreen, PiP, MediaSession

**Files:**
- Modify: `src/hooks/use-video-player.ts`

**Step 1: Add fullscreen state and toggle**

Add to the hook:

```typescript
const [isFullscreen, setIsFullscreen] = useState(false);
const containerRef = useRef<HTMLDivElement>(null);

const toggleFullscreen = useCallback(async () => {
  const el = containerRef.current;
  if (!el) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await el.requestFullscreen();
  }
}, []);

// Inside the useEffect, add fullscreen listener:
const onFullscreenChange = () => {
  setIsFullscreen(!!document.fullscreenElement);
};
document.addEventListener("fullscreenchange", onFullscreenChange);
// ... cleanup: document.removeEventListener("fullscreenchange", onFullscreenChange);
```

**Step 2: Add PiP state and toggle**

```typescript
const [isPip, setIsPip] = useState(false);

const togglePip = useCallback(async () => {
  const video = videoRef.current;
  if (!video) return;
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else {
    await video.requestPictureInPicture();
  }
}, [videoRef]);

// Inside useEffect:
const onPipEnter = () => setIsPip(true);
const onPipLeave = () => setIsPip(false);
video.addEventListener("enterpictureinpicture", onPipEnter);
video.addEventListener("leavepictureinpicture", onPipLeave);
```

**Step 3: Add MediaSession integration**

```typescript
// Separate useEffect for MediaSession:
useEffect(() => {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", () => videoRef.current?.play());
  navigator.mediaSession.setActionHandler("pause", () => videoRef.current?.pause());
  navigator.mediaSession.setActionHandler("seekforward", () => skipBy(10));
  navigator.mediaSession.setActionHandler("seekbackward", () => skipBy(-10));
}, [videoRef, skipBy]);
```

**Step 4: Update hook signature**

The hook now accepts `containerRef` and returns additional state/actions: `isFullscreen`, `isPip`, `containerRef`, `toggleFullscreen`, `togglePip`.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/hooks/use-video-player.ts
git commit -m "feat(video-player): add fullscreen, PiP, and MediaSession to hook"
```

---

### Task 3: VideoPlayer shell component

**Files:**
- Create: `src/components/app/video-player/video-player.tsx`

**Step 1: Create the main component**

```typescript
"use client";

import { useRef, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { useVideoPlayer } from "@/hooks/use-video-player";

export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface Marker {
  time: number;
  label: string;
  content?: ReactNode;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface VideoPlayerProps {
  src: string;
  chapters?: Chapter[];
  markers?: Marker[];
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
  src,
  chapters = [],
  markers = [],
  onTimeUpdate,
  className,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer(videoRef, { onTimeUpdate });

  useImperativeHandle(ref, () => ({ seekTo: player.seek }), [player.seek]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className="w-full aspect-video bg-black"
        onClick={player.togglePlay}
      />
      {/* PlayerControls — Task 4 */}
    </div>
  );
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/app/video-player/video-player.tsx
git commit -m "feat(video-player): add VideoPlayer shell component"
```

---

### Task 4: PlayerControls — play, skip, time display

**Files:**
- Create: `src/components/app/video-player/player-controls.tsx`
- Create: `src/assets/icons/play-icon.tsx`
- Create: `src/assets/icons/pause-icon.tsx`
- Create: `src/assets/icons/skip-back-icon.tsx`
- Create: `src/assets/icons/skip-forward-icon.tsx`
- Create: `src/assets/icons/prev-segment-icon.tsx`
- Create: `src/assets/icons/next-segment-icon.tsx`
- Modify: `src/components/app/video-player/video-player.tsx` — wire in PlayerControls

**Step 1: Create SVG icon components**

Follow existing pattern from `src/assets/icons/chevron-down-icon.tsx`:

```typescript
// play-icon.tsx
export const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

// pause-icon.tsx
export const PauseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

// skip-back-icon.tsx — "◁10"
export const SkipBackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    <text x="10" y="16" fontSize="7" textAnchor="middle" fill="currentColor">10</text>
  </svg>
);

// skip-forward-icon.tsx — "10▷"
export const SkipForwardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
    <text x="14" y="16" fontSize="7" textAnchor="middle" fill="currentColor">10</text>
  </svg>
);

// prev-segment-icon.tsx — "|◁"
export const PrevSegmentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);

// next-segment-icon.tsx — "▷|"
export const NextSegmentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M6 18l8.5-6L6 6v12zm8.5 0h2V6h-2v12z" />
  </svg>
);
```

**Step 2: Create PlayerControls component**

```typescript
// player-controls.tsx
import { Toolbar } from "@base-ui/react/toolbar";
import { PlayIcon } from "@/assets/icons/play-icon";
import { PauseIcon } from "@/assets/icons/pause-icon";
import { SkipBackIcon } from "@/assets/icons/skip-back-icon";
import { SkipForwardIcon } from "@/assets/icons/skip-forward-icon";
import { PrevSegmentIcon } from "@/assets/icons/prev-segment-icon";
import { NextSegmentIcon } from "@/assets/icons/next-segment-icon";
import type { Chapter } from "./video-player";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  chapters: Chapter[];
  onTogglePlay: () => void;
  onSkipBy: (seconds: number) => void;
  onSeek: (time: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  playing,
  currentTime,
  duration,
  chapters,
  onTogglePlay,
  onSkipBy,
  onSeek,
}) => {
  const seekToSegment = (direction: -1 | 1) => {
    if (chapters.length === 0) return;
    const sorted = [...chapters].sort((a, b) => a.startTime - b.startTime);
    if (direction === -1) {
      const prev = sorted.filter((c) => c.startTime < currentTime - 1).pop();
      if (prev) onSeek(prev.startTime);
      else onSeek(0);
    } else {
      const next = sorted.find((c) => c.startTime > currentTime + 1);
      if (next) onSeek(next.startTime);
    }
  };

  return (
    <Toolbar.Root
      className="flex items-center gap-1 px-2 py-1 bg-(--color-background) border-t border-(--color-border)"
    >
      <Toolbar.Button
        onClick={() => seekToSegment(-1)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Предыдущий сегмент"
      >
        <PrevSegmentIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => onSkipBy(-10)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Назад на 10 секунд"
      >
        <SkipBackIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={onTogglePlay}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-primary) text-xl"
        aria-label={playing ? "Пауза" : "Воспроизвести"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => onSkipBy(10)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Вперёд на 10 секунд"
      >
        <SkipForwardIcon />
      </Toolbar.Button>
      <Toolbar.Button
        onClick={() => seekToSegment(1)}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label="Следующий сегмент"
      >
        <NextSegmentIcon />
      </Toolbar.Button>

      <Toolbar.Separator className="w-px h-4 bg-(--color-border) mx-1" />

      <span className="text-xs tabular-nums text-(--color-description) select-none whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </Toolbar.Root>
  );
};
```

**Step 3: Wire PlayerControls into VideoPlayer**

In `video-player.tsx`, import `PlayerControls` and render it below the `<video>` element, passing the player state and actions.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/assets/icons/play-icon.tsx src/assets/icons/pause-icon.tsx src/assets/icons/skip-back-icon.tsx src/assets/icons/skip-forward-icon.tsx src/assets/icons/prev-segment-icon.tsx src/assets/icons/next-segment-icon.tsx src/components/app/video-player/player-controls.tsx src/components/app/video-player/video-player.tsx
git commit -m "feat(video-player): add PlayerControls with play, skip, segment nav"
```

---

### Task 5: Timeline — slider with chapters, buffer, and tooltip

**Files:**
- Create: `src/components/app/video-player/timeline.tsx`
- Modify: `src/components/app/video-player/player-controls.tsx` — add Timeline

**Step 1: Create Timeline component**

The timeline uses Base UI `Slider` for the interactive thumb/track. Chapters are rendered as visual segments on the track with a tooltip showing time + chapter name.

```typescript
// timeline.tsx
import { useState, useCallback } from "react";
import { Slider } from "@base-ui/react/slider";
import { Popover } from "@base-ui/react/popover";
import type { Chapter, Marker } from "./video-player";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getChapterAtTime(chapters: Chapter[], time: number): Chapter | undefined {
  return chapters.find((c) => time >= c.startTime && time < c.endTime);
}

interface TimelineProps {
  currentTime: number;
  duration: number;
  buffered: number;
  chapters: Chapter[];
  markers: Marker[];
  onSeek: (time: number) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  duration,
  buffered,
  chapters,
  markers,
  onSeek,
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverTime(ratio * duration);
    },
    [duration]
  );

  const handlePointerLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const hoverChapter = hoverTime != null ? getChapterAtTime(chapters, hoverTime) : undefined;

  return (
    <div
      className="relative flex-1 group"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Hover tooltip */}
      {hoverTime != null && (
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 pointer-events-none bg-(--color-background) border border-(--color-border) rounded px-2 py-1 text-xs whitespace-nowrap z-10"
          style={{ left: `${(hoverTime / duration) * 100}%` }}
        >
          <span className="tabular-nums">{formatTime(hoverTime)}</span>
          {hoverChapter && (
            <span className="ml-1.5 text-(--color-description)">{hoverChapter.title}</span>
          )}
        </div>
      )}

      <Slider.Root
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onValueChange={(value) => onSeek(value as number)}
        className="relative flex items-center h-6 cursor-pointer touch-none"
      >
        <Slider.Control className="relative flex items-center w-full h-full">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border) group-hover:h-1.5 transition-[height]">
            {/* Buffered range */}
            <div
              className="absolute h-full rounded bg-(--color-description)/30"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            {/* Chapter segments */}
            {chapters.length > 0 &&
              chapters.map((ch, i) => (
                <div
                  key={i}
                  className="absolute h-full bg-(--color-primary)/20"
                  style={{
                    left: `${(ch.startTime / duration) * 100}%`,
                    width: `${((ch.endTime - ch.startTime) / duration) * 100}%`,
                  }}
                />
              ))}
            {/* Chapter dividers */}
            {chapters.length > 1 &&
              chapters.slice(1).map((ch, i) => (
                <div
                  key={`div-${i}`}
                  className="absolute h-full w-0.5 bg-(--color-border)"
                  style={{ left: `${(ch.startTime / duration) * 100}%` }}
                />
              ))}
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-3 h-3 rounded-full bg-(--color-primary) shadow opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>

      {/* Markers */}
      {markers.map((marker, i) => (
        <TimelineMarker key={i} marker={marker} duration={duration} />
      ))}
    </div>
  );
};

// --- Marker with hover popover ---
const TimelineMarker: React.FC<{ marker: Marker; duration: number }> = ({ marker, duration }) => (
  <Popover.Root openOnHover delay={200} closeDelay={300}>
    <Popover.Trigger
      className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-(--color-primary) rounded-sm cursor-pointer z-10"
      style={{ left: `${(marker.time / duration) * 100}%` }}
      aria-label={marker.label}
    />
    <Popover.Portal>
      <Popover.Positioner sideOffset={8}>
        <Popover.Popup className="bg-(--color-background) border border-(--color-border) rounded p-2 text-sm shadow-lg max-w-xs">
          <Popover.Arrow className="fill-(--color-background) stroke-(--color-border)" />
          <p className="font-medium">{marker.label}</p>
          {marker.content}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);
```

**Note:** The Popover `openOnHover` is on the Trigger, not Root — verify this during implementation. If Base UI puts `openOnHover` on Trigger, adjust accordingly. Check: `import { Popover } from "@base-ui/react/popover"` → read the actual types.

**Step 2: Add Timeline to PlayerControls**

In `player-controls.tsx`, import `Timeline` and render it between the time display and the speed slider area, passing `currentTime`, `duration`, `buffered`, `chapters`, `markers`, `onSeek`.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Visual test**

Run: `npm run dev`
Navigate to a lecture page. The timeline should render (even without chapters/markers — shows plain slider). Drag thumb, verify seek works.

**Step 5: Commit**

```bash
git add src/components/app/video-player/timeline.tsx src/components/app/video-player/player-controls.tsx
git commit -m "feat(video-player): add Timeline with chapters, markers, and tooltip"
```

---

### Task 6: SpeedSlider — slider with snap points

**Files:**
- Create: `src/components/app/video-player/speed-slider.tsx`
- Modify: `src/components/app/video-player/player-controls.tsx` — add SpeedSlider

**Step 1: Create SpeedSlider component**

```typescript
// speed-slider.tsx
import { useCallback } from "react";
import { Slider } from "@base-ui/react/slider";

const SNAP_POINTS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SNAP_THRESHOLD = 0.05;

function snapToNearest(value: number): number {
  for (const point of SNAP_POINTS) {
    if (Math.abs(value - point) <= SNAP_THRESHOLD) return point;
  }
  return Math.round(value * 20) / 20; // round to 0.05
}

interface SpeedSliderProps {
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
}

export const SpeedSlider: React.FC<SpeedSliderProps> = ({
  playbackRate,
  onChangePlaybackRate,
}) => {
  const handleChange = useCallback(
    (value: number) => {
      onChangePlaybackRate(snapToNearest(value));
    },
    [onChangePlaybackRate]
  );

  const resetSpeed = useCallback(() => {
    onChangePlaybackRate(1);
  }, [onChangePlaybackRate]);

  return (
    <div className="flex items-center gap-1.5">
      <Slider.Root
        min={0.5}
        max={2}
        step={0.05}
        value={playbackRate}
        onValueChange={(value) => handleChange(value as number)}
        className="relative flex items-center w-16 cursor-pointer touch-none"
        aria-label="Скорость воспроизведения"
      >
        <Slider.Control className="relative flex items-center w-full h-6">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border)">
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-2.5 h-2.5 rounded-full bg-(--color-primary) shadow focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>

      <button
        onClick={resetSpeed}
        className="text-xs tabular-nums text-(--color-description) hover:text-(--color-primary) min-w-[2.5rem] text-center select-none"
        title="Сбросить скорость на 1x"
      >
        {playbackRate.toFixed(2).replace(/\.?0+$/, "")}x
      </button>
    </div>
  );
};
```

**Step 2: Add SpeedSlider to PlayerControls**

In `player-controls.tsx`, render SpeedSlider after the Timeline, passing `playbackRate` and `onChangePlaybackRate`.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/app/video-player/speed-slider.tsx src/components/app/video-player/player-controls.tsx
git commit -m "feat(video-player): add SpeedSlider with snap points"
```

---

### Task 7: VolumeControl — icon + slider

**Files:**
- Create: `src/components/app/video-player/volume-control.tsx`
- Create: `src/assets/icons/volume-icon.tsx`
- Create: `src/assets/icons/volume-muted-icon.tsx`
- Modify: `src/components/app/video-player/player-controls.tsx` — add VolumeControl

**Step 1: Create volume SVG icons**

```typescript
// volume-icon.tsx
export const VolumeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

// volume-muted-icon.tsx
export const VolumeMutedIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);
```

**Step 2: Create VolumeControl component**

```typescript
// volume-control.tsx
import { Slider } from "@base-ui/react/slider";
import { VolumeIcon } from "@/assets/icons/volume-icon";
import { VolumeMutedIcon } from "@/assets/icons/volume-muted-icon";

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onChangeVolume: (v: number) => void;
  onToggleMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
}) => {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggleMute}
        className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
        aria-label={muted ? "Включить звук" : "Выключить звук"}
      >
        {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeIcon />}
      </button>
      <Slider.Root
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onValueChange={(value) => onChangeVolume(value as number)}
        className="relative flex items-center w-16 cursor-pointer touch-none"
        aria-label="Громкость"
      >
        <Slider.Control className="relative flex items-center w-full h-6">
          <Slider.Track className="relative h-1 w-full rounded bg-(--color-border)">
            <Slider.Indicator className="absolute h-full rounded bg-(--color-primary)" />
          </Slider.Track>
          <Slider.Thumb className="block w-2.5 h-2.5 rounded-full bg-(--color-primary) shadow focus-visible:outline-2 focus-visible:outline-(--color-primary)" />
        </Slider.Control>
      </Slider.Root>
    </div>
  );
};
```

**Step 3: Add VolumeControl to PlayerControls**

Wire into `player-controls.tsx` after SpeedSlider.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/assets/icons/volume-icon.tsx src/assets/icons/volume-muted-icon.tsx src/components/app/video-player/volume-control.tsx src/components/app/video-player/player-controls.tsx
git commit -m "feat(video-player): add VolumeControl with icon and slider"
```

---

### Task 8: Fullscreen, PiP, and collapse buttons

**Files:**
- Create: `src/assets/icons/fullscreen-icon.tsx`
- Create: `src/assets/icons/fullscreen-exit-icon.tsx`
- Create: `src/assets/icons/pip-icon.tsx`
- Create: `src/assets/icons/collapse-icon.tsx`
- Modify: `src/components/app/video-player/player-controls.tsx` — add buttons
- Modify: `src/components/app/video-player/video-player.tsx` — pass fullscreen/pip state, collapse logic

**Step 1: Create icon components**

Follow existing SVG pattern. Simple Material-style icons for fullscreen, PiP, and collapse (chevron down).

**Step 2: Add fullscreen, PiP, collapse to PlayerControls**

```typescript
// Additional props in PlayerControlsProps:
isFullscreen: boolean;
isPip: boolean;
collapsed: boolean;
onToggleFullscreen: () => void;
onTogglePip: () => void;
onToggleCollapse: () => void;

// Render after VolumeControl:
<Toolbar.Separator className="w-px h-4 bg-(--color-border) mx-1" />

<Toolbar.Button
  onClick={onTogglePip}
  className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
  aria-label={isPip ? "Выйти из картинки в картинке" : "Картинка в картинке"}
>
  <PipIcon />
</Toolbar.Button>

<Toolbar.Button
  onClick={onToggleFullscreen}
  className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
  aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
>
  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
</Toolbar.Button>

<Toolbar.Button
  onClick={onToggleCollapse}
  className="p-1.5 rounded hover:bg-(--color-text-pane) text-(--color-description) text-lg"
  aria-label="Свернуть контролы"
>
  <CollapseIcon />
</Toolbar.Button>
```

**Step 3: Add collapse state and show/hide logic to VideoPlayer**

In `video-player.tsx`:
- Add `const [collapsed, setCollapsed] = useState(false)`
- When collapsed: show a small pill (play icon + time) at bottom-right
- On hover/tap on video or pill: show controls
- Animate with `framer-motion` `AnimatePresence` + `motion.div`

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Visual test**

Run: `npm run dev`
Test: fullscreen button, PiP button, collapse/expand. Verify framer-motion animation.

**Step 6: Commit**

```bash
git add src/assets/icons/fullscreen-icon.tsx src/assets/icons/fullscreen-exit-icon.tsx src/assets/icons/pip-icon.tsx src/assets/icons/collapse-icon.tsx src/components/app/video-player/player-controls.tsx src/components/app/video-player/video-player.tsx
git commit -m "feat(video-player): add fullscreen, PiP, collapse buttons with animation"
```

---

### Task 9: Keyboard shortcuts

**Files:**
- Modify: `src/hooks/use-video-player.ts` — add keyboard event handler
- Modify: `src/components/app/video-player/video-player.tsx` — attach keyboard handler to container

**Step 1: Add keyboard handler to useVideoPlayer**

```typescript
const handleKeyDown = useCallback(
  (e: KeyboardEvent) => {
    const video = videoRef.current;
    if (!video) return;
    // Don't handle if typing in an input
    if ((e.target as HTMLElement).tagName === "INPUT") return;

    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        skipBy(-10);
        break;
      case "ArrowRight":
        e.preventDefault();
        skipBy(10);
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(video.volume + 0.05);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(video.volume - 0.05);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "p":
        togglePip();
        break;
      case "<":
        changePlaybackRate(video.playbackRate - 0.25);
        break;
      case ">":
        changePlaybackRate(video.playbackRate + 0.25);
        break;
    }
  },
  [videoRef, togglePlay, skipBy, changeVolume, toggleMute, toggleFullscreen, togglePip, changePlaybackRate]
);
```

Return `handleKeyDown` from the hook.

**Step 2: Attach to container in VideoPlayer**

```typescript
// In video-player.tsx, add tabIndex and onKeyDown:
<div
  ref={containerRef}
  tabIndex={0}
  onKeyDown={player.handleKeyDown as unknown as React.KeyboardEventHandler}
  className={`relative outline-none ${className ?? ""}`}
>
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Visual test**

Run: `npm run dev`
Focus the player, test: Space (play/pause), arrows (seek/volume), M (mute), F (fullscreen), < > (speed).

**Step 5: Commit**

```bash
git add src/hooks/use-video-player.ts src/components/app/video-player/video-player.tsx
git commit -m "feat(video-player): add keyboard shortcuts"
```

---

### Task 10: Integrate into LectureSync, replace native controls

**Files:**
- Modify: `src/app/lectures/[id]/lecture-sync.tsx` — replace `<video>` with `<VideoPlayer>`
- Modify: `src/hooks/use-synced-player.ts` — simplify or remove (VideoPlayer handles its own state)

**Step 1: Update LectureSync**

Replace the bare `<video>` element with `<VideoPlayer>`:

```typescript
import { useRef, useState } from "react";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/app/video-player/video-player";

// In the component:
const playerRef = useRef<VideoPlayerHandle>(null);
const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null);

const seekTo = (time: number) => {
  playerRef.current?.seekTo(time);
};

// JSX:
{videoUrl ? (
  <VideoPlayer
    ref={playerRef}
    src={videoUrl}
    onTimeUpdate={(time) => {
      const segment = segments.find((s) => time >= (s.start ?? 0) && time <= (s.end ?? 0));
      setCurrentSegmentId(segment?.id ?? null);
    }}
  />
) : (
  <div className="...">Видео недоступно</div>
)}
```

`VideoPlayer` exposes `seekTo` via `forwardRef` + `useImperativeHandle` (see Task 3). `useSyncedPlayer` can be removed — its logic is replaced by `onTimeUpdate` + `playerRef.current?.seekTo()`.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Visual test**

Run: `npm run dev`
Navigate to a lecture page. Verify:
- Custom player renders with all controls
- Transcript clicking seeks video
- Transcript highlighting syncs with playback
- All buttons work

**Step 4: Commit**

```bash
git add src/app/lectures/[id]/lecture-sync.tsx src/hooks/use-synced-player.ts src/components/app/video-player/video-player.tsx
git commit -m "feat(video-player): integrate VideoPlayer into LectureSync"
```

---

### Task 11: Mobile adaptations

**Files:**
- Modify: `src/components/app/video-player/player-controls.tsx` — responsive layout
- Modify: `src/components/app/video-player/speed-slider.tsx` — popover on mobile
- Modify: `src/components/app/video-player/volume-control.tsx` — popover on mobile

**Step 1: Make controls responsive**

On small screens (`md:` breakpoint):
- Speed slider and volume slider are hidden, replaced by icon buttons
- Tapping the speed icon opens a popover with the slider
- Tapping the volume icon opens a popover with the slider
- Use Base UI `Popover` for these mobile popovers

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Visual test**

Run: `npm run dev`
Resize to mobile width. Verify: controls compact, popovers work for speed/volume.

**Step 4: Commit**

```bash
git add src/components/app/video-player/player-controls.tsx src/components/app/video-player/speed-slider.tsx src/components/app/video-player/volume-control.tsx
git commit -m "feat(video-player): add mobile-responsive controls with popovers"
```

---

### Task 12: Final build verification

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any fixes**

If there are lint/build issues, fix and commit:

```bash
git commit -m "fix(video-player): address lint and build issues"
```

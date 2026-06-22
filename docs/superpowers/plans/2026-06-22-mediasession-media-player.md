# mediaSession для медиа-плеера (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить `navigator.mediaSession` к нативному `<audio>`/`<video>` на `/media/[id]` — метаданные, обработчики действий, прогресс в ОС и возобновление позиции — как прогрессивное улучшение.

**Architecture:** Два изолированных клиентских хука внутри фичи `media` (`useMediaSession`, `useResumePlayback`), привязанные к ref медиа-элемента, плюс тонкая правка `MediaPlayer` (callback-ref + вызов хуков) и проброс `mediaId` из `MediaDetail`. Хуки feature-detect'ят API и без него — no-op.

**Tech Stack:** Next.js (App Router, React 19), TypeScript, Vitest + @testing-library/react (jsdom), pnpm.

## Global Constraints

- **Пакетный менеджер — pnpm**, не npm (npm ломает тулчейн).
- **Прогрессивное улучшение:** всё под `"mediaSession" in navigator` / `try/catch` вокруг `localStorage`; без поддержки — плеер работает как сейчас, без ошибок.
- **Только в фиче** `src/features/media/**` + i18n-сообщения `src/i18n/messages/{ru,en}/media.ts`. **Не трогать** frozen-зоны (`src/app/layout.tsx`, `src/components/ui/*`, `src/hooks/*`, `src/api/schema.ts` и др.).
- **Ноль бекенда, ноль новых зависимостей.**
- **Имена файлов** — kebab-case.
- **i18n-паритет** ru/en обязателен (есть тест-гард паритета ключей).
- **git:** добавлять только свои файлы по имени (`git add <files>`), без `git add -A`/`.`; никаких деструктивных git-операций.
- **Перед PR зелёные:** `pnpm lint && pnpm test && pnpm build`.
- **Сообщения коммитов** заканчивать строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Хук `useMediaSession`

Привязывает `navigator.mediaSession` к media-элементу: metadata, action-handlers (play/pause/seek/seekto), playbackState, setPositionState. Снимает всё на unmount. No-op без поддержки.

**Files:**
- Create: `src/features/media/ui/use-media-session.ts`
- Test: `src/features/media/ui/use-media-session.test.tsx`

**Interfaces:**
- Consumes: ничего (первый таск).
- Produces:
  ```ts
  export interface MediaSessionMeta { title: string; artist: string }
  export function useMediaSession(
    ref: RefObject<HTMLMediaElement | null>,
    meta: MediaSessionMeta,
  ): void
  ```

- [ ] **Step 1: Написать падающий тест**

Create `src/features/media/ui/use-media-session.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaSession } from "./use-media-session";

// --- Фейк media-элемента (jsdom не даёт настоящего воспроизведения) ---
class FakeMediaElement {
  currentTime = 0;
  duration = 100;
  playbackRate = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  fastSeek = vi.fn((t: number) => {
    this.currentTime = t;
  });
  private listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, cb: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    this.listeners.set(type, set);
    set.add(cb);
  }
  removeEventListener(type: string, cb: EventListener): void {
    this.listeners.get(type)?.delete(cb);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((cb) => {
      cb(new Event(type));
    });
  }
}

// --- Фейк navigator.mediaSession ---
class FakeMediaSession {
  metadata: unknown = null;
  playbackState = "none";
  handlers = new Map<string, ((d: MediaSessionActionDetails) => void) | null>();
  setActionHandler = vi.fn(
    (action: string, handler: ((d: MediaSessionActionDetails) => void) | null) => {
      this.handlers.set(action, handler);
    },
  );
  setPositionState = vi.fn();
  invoke(action: string, details: Partial<MediaSessionActionDetails> = {}): void {
    this.handlers.get(action)?.(details as MediaSessionActionDetails);
  }
}

class FakeMediaMetadata {
  title: string;
  artist: string;
  artwork: unknown[];
  constructor(init: { title?: string; artist?: string; artwork?: unknown[] }) {
    this.title = init.title ?? "";
    this.artist = init.artist ?? "";
    this.artwork = init.artwork ?? [];
  }
}

let ms: FakeMediaSession;
function installMediaSession(): void {
  ms = new FakeMediaSession();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: ms,
  });
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
}

function refFor(el: FakeMediaElement) {
  return { current: el as unknown as HTMLMediaElement };
}

const META = { title: "Бытие и время", artist: "Философия ликбез" };

afterEach(() => {
  Reflect.deleteProperty(navigator as object, "mediaSession");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useMediaSession", () => {
  beforeEach(() => {
    installMediaSession();
  });

  it("ставит metadata из meta", () => {
    const el = new FakeMediaElement();
    renderHook(() => useMediaSession(refFor(el), META));
    expect((ms.metadata as FakeMediaMetadata).title).toBe("Бытие и время");
    expect((ms.metadata as FakeMediaMetadata).artist).toBe("Философия ликбез");
    expect((ms.metadata as FakeMediaMetadata).artwork.length).toBeGreaterThan(0);
  });

  it("регистрирует play/pause/seek*, но НЕ previoustrack/nexttrack", () => {
    const el = new FakeMediaElement();
    renderHook(() => useMediaSession(refFor(el), META));
    for (const a of ["play", "pause", "seekbackward", "seekforward", "seekto"]) {
      expect(ms.handlers.has(a)).toBe(true);
    }
    expect(ms.handlers.has("previoustrack")).toBe(false);
    expect(ms.handlers.has("nexttrack")).toBe(false);
  });

  it("play/pause действия проксируются на элемент", () => {
    const el = new FakeMediaElement();
    renderHook(() => useMediaSession(refFor(el), META));
    ms.invoke("play");
    expect(el.play).toHaveBeenCalledTimes(1);
    ms.invoke("pause");
    expect(el.pause).toHaveBeenCalledTimes(1);
  });

  it("seekbackward/seekforward сдвигают currentTime с клампом", () => {
    const el = new FakeMediaElement();
    el.currentTime = 30;
    renderHook(() => useMediaSession(refFor(el), META));
    ms.invoke("seekbackward", { seekOffset: 10 });
    expect(el.currentTime).toBe(20);
    el.currentTime = 5;
    ms.invoke("seekbackward", { seekOffset: 10 });
    expect(el.currentTime).toBe(0); // кламп к 0
    el.currentTime = 95;
    ms.invoke("seekforward", { seekOffset: 10 });
    expect(el.currentTime).toBe(100); // кламп к duration
  });

  it("seekto: с fastSeek и без", () => {
    const el = new FakeMediaElement();
    renderHook(() => useMediaSession(refFor(el), META));
    ms.invoke("seekto", { seekTime: 42 });
    expect(el.currentTime).toBe(42);
    ms.invoke("seekto", { seekTime: 60, fastSeek: true });
    expect(el.fastSeek).toHaveBeenCalledWith(60);
  });

  it("playbackState следует за событиями элемента", () => {
    const el = new FakeMediaElement();
    renderHook(() => useMediaSession(refFor(el), META));
    el.emit("play");
    expect(ms.playbackState).toBe("playing");
    el.emit("pause");
    expect(ms.playbackState).toBe("paused");
  });

  it("setPositionState вызывается при конечной длительности", () => {
    const el = new FakeMediaElement();
    el.currentTime = 12;
    renderHook(() => useMediaSession(refFor(el), META));
    el.emit("loadedmetadata");
    expect(ms.setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 100, position: 12 }),
    );
  });

  it("setPositionState пропускается при бесконечной длительности (стрим)", () => {
    const el = new FakeMediaElement();
    el.duration = Infinity;
    renderHook(() => useMediaSession(refFor(el), META));
    el.emit("timeupdate");
    expect(ms.setPositionState).not.toHaveBeenCalled();
  });

  it("unmount снимает хендлеры и сбрасывает metadata", () => {
    const el = new FakeMediaElement();
    const { unmount } = renderHook(() => useMediaSession(refFor(el), META));
    unmount();
    for (const a of ["play", "pause", "seekbackward", "seekforward", "seekto"]) {
      expect(ms.handlers.get(a)).toBeNull();
    }
    expect(ms.metadata).toBeNull();
    expect(ms.playbackState).toBe("none");
  });

  it("без mediaSession — no-op без ошибок", () => {
    Reflect.deleteProperty(navigator as object, "mediaSession");
    const el = new FakeMediaElement();
    expect(() => {
      renderHook(() => useMediaSession(refFor(el), META));
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/use-media-session.test.tsx`
Expected: FAIL — `Failed to resolve import "./use-media-session"` (файла ещё нет).

- [ ] **Step 3: Реализовать хук**

Create `src/features/media/ui/use-media-session.ts`:

```ts
// src/features/media/ui/use-media-session.ts
import { useEffect } from "react";

import type { RefObject } from "react";

export interface MediaSessionMeta {
  title: string;
  artist: string;
}

/** Шаг перемотки по умолчанию (сек), если ОС не прислала seekOffset. */
const SEEK_STEP = 10;

/** Обложка для локскрина — иконки приложения из манифеста. */
const ARTWORK = [
  { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
];

/**
 * Привязывает navigator.mediaSession к media-элементу: метаданные, обработчики
 * действий (play/pause/seek/seekto), playbackState и setPositionState.
 * Прогрессивное улучшение — no-op без поддержки. Все хендлеры/слушатели
 * снимаются на unmount.
 */
export function useMediaSession(
  ref: RefObject<HTMLMediaElement | null>,
  meta: MediaSessionMeta,
): void {
  const { title, artist } = meta;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const ms = navigator.mediaSession;

    ms.metadata = new MediaMetadata({ title, artist, artwork: [...ARTWORK] });

    const updatePosition = (): void => {
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const position = Math.min(Math.max(el.currentTime, 0), duration);
      try {
        ms.setPositionState({
          duration,
          position,
          playbackRate: el.playbackRate || 1,
        });
      } catch {
        // некоторые браузеры бросают на невалидном state — игнорируем
      }
    };

    const onPlay = (): void => {
      ms.playbackState = "playing";
      updatePosition();
    };
    const onPause = (): void => {
      ms.playbackState = "paused";
    };

    el.addEventListener("loadedmetadata", updatePosition);
    el.addEventListener("timeupdate", updatePosition);
    el.addEventListener("ratechange", updatePosition);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void el.play()],
      ["pause", () => el.pause()],
      [
        "seekbackward",
        (d) => {
          const offset = d.seekOffset ?? SEEK_STEP;
          el.currentTime = Math.max(0, el.currentTime - offset);
        },
      ],
      [
        "seekforward",
        (d) => {
          const offset = d.seekOffset ?? SEEK_STEP;
          const max = Number.isFinite(el.duration) ? el.duration : Infinity;
          el.currentTime = Math.min(max, el.currentTime + offset);
        },
      ],
      [
        "seekto",
        (d) => {
          if (d.seekTime == null) return;
          if (d.fastSeek && "fastSeek" in el) {
            el.fastSeek(d.seekTime);
            return;
          }
          el.currentTime = d.seekTime;
        },
      ],
    ];
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // действие не поддерживается этим браузером — пропускаем
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
      el.removeEventListener("loadedmetadata", updatePosition);
      el.removeEventListener("timeupdate", updatePosition);
      el.removeEventListener("ratechange", updatePosition);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      ms.metadata = null;
      ms.playbackState = "none";
    };
  }, [ref, title, artist]);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/use-media-session.test.tsx`
Expected: PASS (все it зелёные).

- [ ] **Step 5: Коммит**

```bash
git add src/features/media/ui/use-media-session.ts src/features/media/ui/use-media-session.test.tsx
git commit -m "$(cat <<'EOF'
feat(media): хук useMediaSession (navigator.mediaSession для плеера)

metadata + action-handlers (play/pause/seek/seekto) + playbackState +
setPositionState. Прогрессивное улучшение, no-op без поддержки, cleanup
на unmount. previoustrack/nexttrack не регистрируются (очереди нет).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Хук `useResumePlayback`

localStorage-возобновление позиции воспроизведения (временный стопгап — бек не хранит позицию). Тихо, без UI.

**Files:**
- Create: `src/features/media/ui/use-resume-playback.ts`
- Test: `src/features/media/ui/use-resume-playback.test.tsx`

**Interfaces:**
- Consumes: ничего.
- Produces:
  ```ts
  export function useResumePlayback(
    ref: RefObject<HTMLMediaElement | null>,
    mediaId: string,
  ): void
  ```
- Ключ localStorage: `media-resume:<mediaId>`.

- [ ] **Step 1: Написать падающий тест**

Create `src/features/media/ui/use-resume-playback.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResumePlayback } from "./use-resume-playback";

class FakeMediaElement {
  currentTime = 0;
  duration = 100;
  private listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, cb: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    this.listeners.set(type, set);
    set.add(cb);
  }
  removeEventListener(type: string, cb: EventListener): void {
    this.listeners.get(type)?.delete(cb);
  }
  emit(type: string): void {
    this.listeners.get(type)?.forEach((cb) => {
      cb(new Event(type));
    });
  }
}

function refFor(el: FakeMediaElement) {
  return { current: el as unknown as HTMLMediaElement };
}

const KEY = "media-resume:m1";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useResumePlayback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("возобновляет сохранённую позицию на loadedmetadata", () => {
    localStorage.setItem(KEY, "42");
    const el = new FakeMediaElement();
    renderHook(() => useResumePlayback(refFor(el), "m1"));
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(42);
  });

  it("не возобновляет, если позиция < 5с (почти начало)", () => {
    localStorage.setItem(KEY, "3");
    const el = new FakeMediaElement();
    renderHook(() => useResumePlayback(refFor(el), "m1"));
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(0);
  });

  it("не возобновляет у самого конца (> duration − 5с)", () => {
    localStorage.setItem(KEY, "98"); // duration=100
    const el = new FakeMediaElement();
    renderHook(() => useResumePlayback(refFor(el), "m1"));
    el.emit("loadedmetadata");
    expect(el.currentTime).toBe(0);
  });

  it("пишет позицию на timeupdate с троттлингом", () => {
    vi.useFakeTimers();
    const el = new FakeMediaElement();
    renderHook(() => useResumePlayback(refFor(el), "m1"));

    el.currentTime = 10;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("10"); // первая запись сразу

    el.currentTime = 11;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("10"); // троттл — не записалось

    vi.advanceTimersByTime(5000);
    el.currentTime = 20;
    el.emit("timeupdate");
    expect(localStorage.getItem(KEY)).toBe("20"); // после окна — записалось
  });

  it("очищает ключ на ended", () => {
    localStorage.setItem(KEY, "42");
    const el = new FakeMediaElement();
    renderHook(() => useResumePlayback(refFor(el), "m1"));
    el.emit("ended");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("недоступный localStorage — тихий no-op без ошибок", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const el = new FakeMediaElement();
    el.currentTime = 10;
    expect(() => {
      renderHook(() => useResumePlayback(refFor(el), "m1"));
      el.emit("timeupdate");
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/use-resume-playback.test.tsx`
Expected: FAIL — `Failed to resolve import "./use-resume-playback"`.

- [ ] **Step 3: Реализовать хук**

Create `src/features/media/ui/use-resume-playback.ts`:

```ts
// src/features/media/ui/use-resume-playback.ts
import { useEffect } from "react";

import type { RefObject } from "react";

const KEY_PREFIX = "media-resume:";
/** Не возобновляем, если сохранённая позиция меньше — почти начало. */
const MIN_RESUME = 5;
/** Не возобновляем, если позиция ближе к концу, чем (duration − END_GUARD). */
const END_GUARD = 5;
/** Минимальный интервал между записями позиции, мс. */
const SAVE_THROTTLE_MS = 5000;

function readPos(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function writePos(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // приватный режим / квота / хранилище выключено — тихо
  }
}
function removePos(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Возобновление позиции воспроизведения через localStorage. Временный стопгап —
 * бек не хранит позицию (см. бек-аски в спеке). Без визуального UI.
 */
export function useResumePlayback(
  ref: RefObject<HTMLMediaElement | null>,
  mediaId: string,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = `${KEY_PREFIX}${mediaId}`;

    const onLoaded = (): void => {
      const saved = readPos(key);
      if (saved == null) return;
      const duration = el.duration;
      const upper = Number.isFinite(duration) ? duration - END_GUARD : Infinity;
      if (saved > MIN_RESUME && saved < upper) {
        el.currentTime = saved;
      }
    };

    let lastSaved = -Infinity;
    const onTimeUpdate = (): void => {
      const now = Date.now();
      if (now - lastSaved < SAVE_THROTTLE_MS) return;
      lastSaved = now;
      writePos(key, el.currentTime);
    };

    const onEnded = (): void => {
      removePos(key);
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [ref, mediaId]);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/use-resume-playback.test.tsx`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add src/features/media/ui/use-resume-playback.ts src/features/media/ui/use-resume-playback.test.tsx
git commit -m "$(cat <<'EOF'
feat(media): хук useResumePlayback (resume через localStorage)

Сохраняет/возобновляет позицию воспроизведения по media-id с порогами
(>5с, не у конца) и троттлингом записи. Временный стопгап — бек не хранит
позицию. Тихо, под try/catch.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Подключить хуки в `MediaPlayer` + проброс `mediaId` + i18n

Тонкая правка плеера (callback-ref + вызов хуков), новый проп `mediaId`, его проброс из `MediaDetail`, и i18n-ключ для строки `artist`. Интеграционный тест проверяет сквозную проводку.

**Files:**
- Modify: `src/features/media/ui/media-player.tsx`
- Modify: `src/features/media/ui/media-detail.tsx:53` (вызов `<MediaPlayer>`)
- Modify: `src/i18n/messages/ru/media.ts`
- Modify: `src/i18n/messages/en/media.ts`
- Test: `src/features/media/ui/media-player.test.tsx`

**Interfaces:**
- Consumes: `useMediaSession(ref, { title, artist })` (Task 1), `useResumePlayback(ref, mediaId)` (Task 2).
- Produces: `MediaPlayer` теперь требует проп `mediaId: string`.

- [ ] **Step 1: Добавить i18n-ключ `playerArtist` (ru + en)**

In `src/i18n/messages/ru/media.ts`, в блок `// --- тип и статус ---` добавить ключ:

```ts
  // --- тип и статус ---
  typeVideo: "Видео",
  typeAudio: "Аудио",
  statusPublic: "Опубликовано",
  statusPrivate: "Приватно",

  // --- плеер ---
  playerArtist: "Философия ликбез",
```

In `src/i18n/messages/en/media.ts` — зеркально (бренд оставляем как есть, паритет ключей обязателен):

```ts
  // --- type and status ---
  typeVideo: "Video",
  typeAudio: "Audio",
  statusPublic: "Published",
  statusPrivate: "Private",

  // --- player ---
  playerArtist: "Философия ликбез",
```

- [ ] **Step 2: Написать интеграционный тест плеера**

Create `src/features/media/ui/media-player.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Клиентский i18n: t(key) → key (для artist достаточно).
vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));

import { MediaPlayer } from "./media-player";

class FakeMediaSession {
  metadata: unknown = null;
  playbackState = "none";
  setActionHandler = vi.fn();
  setPositionState = vi.fn();
}
class FakeMediaMetadata {
  title: string;
  constructor(init: { title?: string }) {
    this.title = init.title ?? "";
  }
}

let ms: FakeMediaSession;
beforeEach(() => {
  ms = new FakeMediaSession();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: ms,
  });
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator as object, "mediaSession");
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MediaPlayer + mediaSession", () => {
  it("audio: рендерит <audio> и ставит metadata.title без расширения", () => {
    const { container } = render(
      <MediaPlayer
        url="https://x/a.mp3"
        type="audio"
        filename="Бытие и время.mp3"
        mediaId="m1"
      />,
    );
    expect(container.querySelector("audio")).not.toBeNull();
    expect((ms.metadata as FakeMediaMetadata).title).toBe("Бытие и время");
  });

  it("video: рендерит <video>", () => {
    const { container } = render(
      <MediaPlayer
        url="https://x/v.mp4"
        type="video"
        filename="lecture-1.mp4"
        mediaId="m2"
      />,
    );
    expect(container.querySelector("video")).not.toBeNull();
    expect((ms.metadata as FakeMediaMetadata).title).toBe("lecture-1");
  });

  it("файл без расширения — title как есть", () => {
    render(
      <MediaPlayer url="https://x/a" type="audio" filename="lecture" mediaId="m3" />,
    );
    expect((ms.metadata as FakeMediaMetadata).title).toBe("lecture");
    // sanity: компонент отрендерился
    expect(screen.getByLabelText("lecture")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/media-player.test.tsx`
Expected: FAIL — `MediaPlayer` ещё не принимает `mediaId` и не выставляет `metadata` (title будет пустой / проп-ошибка типов в рантайме отсутствует, но assert на title упадёт).

- [ ] **Step 4: Переписать `MediaPlayer`**

Replace полностью `src/features/media/ui/media-player.tsx`:

```tsx
"use client";
// src/features/media/ui/media-player.tsx
import { useCallback, useRef } from "react";

import { useT } from "@/i18n/client";

import type { FileType } from "../types";

import { useMediaSession } from "./use-media-session";
import { useResumePlayback } from "./use-resume-playback";

interface MediaPlayerProps {
  /** Подписанный url с бекенда (GET /api/media/{id} возвращает url). */
  url: string;
  type: FileType;
  filename: string;
  /** id медиа — ключ для возобновления позиции. */
  mediaId: string;
}

/** filename → title без расширения для metadata локскрина. */
function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Нативный плеер без сторонних библиотек: <video> для type=video,
 * <audio> для type=audio. url — подписанная ссылка с бекенда. Подключает
 * navigator.mediaSession и возобновление позиции (прогрессивное улучшение).
 */
export function MediaPlayer({ url, type, filename, mediaId }: MediaPlayerProps) {
  const t = useT("media");
  const ref = useRef<HTMLMediaElement>(null);
  // callback-ref: один ref на <audio>/<video> без cast (контравариантность
  // параметра позволяет (HTMLMediaElement|null) => void там, где ждут <video>).
  const setRef = useCallback((el: HTMLMediaElement | null) => {
    ref.current = el;
  }, []);

  useMediaSession(ref, {
    title: stripExtension(filename),
    artist: t("playerArtist"),
  });
  useResumePlayback(ref, mediaId);

  if (type === "video") {
    return (
      <video
        ref={setRef}
        controls
        preload="metadata"
        className="w-full max-h-[70vh] rounded bg-black"
      >
        <source src={url} />
        <track kind="captions" />
        {t("videoBrowserFallback")}
      </video>
    );
  }
  return (
    <audio
      ref={setRef}
      controls
      preload="metadata"
      className="w-full"
      aria-label={filename}
    >
      <source src={url} />
      <track kind="captions" />
      {t("audioBrowserFallback")}
    </audio>
  );
}
```

- [ ] **Step 5: Пробросить `mediaId` из `MediaDetail`**

In `src/features/media/ui/media-detail.tsx`, в JSX заменить вызов плеера:

```tsx
      {media.url ? (
        <MediaPlayer
          url={media.url}
          type={media.type}
          filename={media.filename}
          mediaId={media.id}
        />
      ) : (
```

- [ ] **Step 6: Запустить тест плеера — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/media-player.test.tsx`
Expected: PASS.

- [ ] **Step 7: Прогнать гейт фичи целиком**

Run: `pnpm exec vitest run src/features/media`
Expected: PASS (новые тесты + существующие media-тесты зелёные).

- [ ] **Step 8: Коммит**

```bash
git add src/features/media/ui/media-player.tsx src/features/media/ui/media-player.test.tsx src/features/media/ui/media-detail.tsx src/i18n/messages/ru/media.ts src/i18n/messages/en/media.ts
git commit -m "$(cat <<'EOF'
feat(media): подключить mediaSession + resume к MediaPlayer

callback-ref на <audio>/<video>, вызов useMediaSession/useResumePlayback,
новый проп mediaId (проброс из MediaDetail), i18n-ключ playerArtist.
Title локскрина = filename без расширения.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Финальная проверка (после всех тасков)

- [ ] **Полный гейт перед PR**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Если `pnpm test` ругается на coverage-thresholds — проверить, что новые файлы покрыты тестами (они покрыты по дизайну); пороги в `vitest.config.ts` не трогать.

- [ ] **Ручная браузер-приёмка** (вне CI, отметить в PR):
  - На `/media/[id]` с аудио: открыть, нажать play → в шторке ОС / на локскрине появляются название (filename без расширения), бренд и обложка; кнопки play/pause/перемотка ±10с работают; прогресс отражается.
  - Перемотать, уйти со страницы и вернуться, нажать play → воспроизведение возобновляется с сохранённой позиции (не у конца, не у самого начала).
  - Проверить видео аналогично.
  - Браузер без mediaSession (или приватный режим для localStorage) → плеер работает как раньше, без ошибок в консоли.

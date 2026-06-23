# Видео Picture-in-Picture (Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить к существующему `<video>` на `/media/[id]` нативный Picture-in-Picture (стандартный API + WebKit-fallback для iOS Safari) как прогрессивное улучшение.

**Architecture:** Клиентский хук `usePictureInPicture(videoRef)` инкапсулирует оба API (детект/состояние/toggle); kit-кнопка `PipButton` рендерится только при поддержке и тоглит PiP; общая иконка `PictureInPictureIcon` в `src/assets/icons`; проводка в video-ветку `MediaPlayer` + i18n-ключи.

**Tech Stack:** Next.js (App Router, React 19), TypeScript, Vitest + @testing-library/react (jsdom), pnpm.

## Global Constraints

- **Пакетный менеджер — pnpm**, не npm. Одиночный тест: `pnpm exec vitest run <file>`.
- **Прогрессивное улучшение:** PiP под feature-detect (стандарт `document.pictureInPictureEnabled` / webkit `webkitSupportsPresentationMode`); нет поддержки → кнопки нет, плеер как сейчас. Видео-only (аудио-ветка не трогается).
- **Кросс-браузерность Chrome ≡ Safari обязательна:** стандартный API + WebKit-fallback (`webkitSetPresentationMode`) для iOS Safari.
- **Зоны:** фича `src/features/media/**` + ОДНА общая иконка `src/assets/icons/picture-in-picture-icon.tsx` + i18n `src/i18n/messages/{ru,en}/media.ts`. **Не трогать** frozen-зоны (`src/app/layout.tsx`, `src/components/ui/*`, `src/hooks/*`, `src/api/schema.ts`).
- **Kit (Guardrail 7/8):** кнопка — `IconButton` из `@/components/ui`; SVG-иконка не интерактивна (живёт в общем `src/assets/icons/`).
- **Ноль бекенда, ноль новых зависимостей.** kebab-case имён. i18n-паритет ru/en обязателен (есть тест-гард).
- **Lint (строгий @typescript-eslint):** пустые тела функций/catch требуют комментарий внутри (иначе `no-empty-function`); `.catch(() => { /* … */ })` как statement — идиома проекта (`use-register-sw.ts:66`), без `void`; в тестах НЕ использовать `container.querySelector` (testing-library/no-container, no-node-access — error), КРОМЕ icon-теста с точечным `// eslint-disable-next-line` (прецедент `chevron-icon.test.tsx`).
- **git:** добавлять только свои файлы по имени (`git add <files>` + `git commit --only <те же>`), без `git add -A`/`.`; никаких деструктивных git-операций. Сообщение коммита заканчивать строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Перед PR зелёные:** `pnpm lint && pnpm test && pnpm build`.

---

### Task 1: Хук `usePictureInPicture`

Инкапсулирует оба PiP-API: детект поддержки, состояние `active` по событиям, `toggle` вход/выход. Прогрессивное улучшение, cleanup на unmount.

**Files:**
- Create: `src/features/media/ui/use-picture-in-picture.ts`
- Test: `src/features/media/ui/use-picture-in-picture.test.tsx`

**Interfaces:**
- Consumes: ничего (первый таск).
- Produces:
  ```ts
  export function usePictureInPicture(
    videoRef: RefObject<HTMLMediaElement | null>,
  ): { supported: boolean; active: boolean; toggle: () => void }
  ```

- [ ] **Step 1: Написать падающий тест**

Create `src/features/media/ui/use-picture-in-picture.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePictureInPicture } from "./use-picture-in-picture";

// --- Фейк video со СТАНДАРТНЫМ PiP (Chrome/десктоп-Safari) ---
class FakeStandardVideo {
  disablePictureInPicture = false;
  requestPictureInPicture = vi.fn(() => Promise.resolve({}));
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
  hasListeners(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0;
  }
}

// --- Фейк video с WEBKIT PiP (iOS Safari): нет стандартного API ---
class FakeWebkitVideo {
  webkitPresentationMode = "inline";
  webkitSupportsPresentationMode = vi.fn((m: string) => m === "picture-in-picture");
  webkitSetPresentationMode = vi.fn((m: string) => {
    this.webkitPresentationMode = m;
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

// --- Фейк video БЕЗ PiP вообще (хук рано выходит, методы не нужны) ---
class FakeNoVideo {}

function refFor(el: unknown) {
  return { current: el as HTMLMediaElement };
}

function setDocPiP(opts: { enabled: boolean; element?: unknown }): void {
  Object.defineProperty(document, "pictureInPictureEnabled", {
    configurable: true,
    value: opts.enabled,
  });
  Object.defineProperty(document, "pictureInPictureElement", {
    configurable: true,
    value: opts.element ?? null,
  });
}

const exitMock = vi.fn(() => Promise.resolve());

beforeEach(() => {
  Object.defineProperty(document, "exitPictureInPicture", {
    configurable: true,
    value: exitMock,
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, "pictureInPictureEnabled");
  Reflect.deleteProperty(document, "pictureInPictureElement");
  Reflect.deleteProperty(document, "exitPictureInPicture");
  vi.clearAllMocks();
});

describe("usePictureInPicture — поддержка", () => {
  it("стандартный API → supported=true", () => {
    setDocPiP({ enabled: true });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeStandardVideo())));
    expect(result.current.supported).toBe(true);
  });

  it("только webkit (iOS, document.pictureInPictureEnabled=false) → supported=true", () => {
    setDocPiP({ enabled: false });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeWebkitVideo())));
    expect(result.current.supported).toBe(true);
  });

  it("нет ни одного API → supported=false", () => {
    setDocPiP({ enabled: false });
    const { result } = renderHook(() => usePictureInPicture(refFor(new FakeNoVideo())));
    expect(result.current.supported).toBe(false);
  });
});

describe("usePictureInPicture — toggle", () => {
  it("стандарт, не активно → requestPictureInPicture", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.requestPictureInPicture).toHaveBeenCalledTimes(1);
  });

  it("стандарт, активно → exitPictureInPicture", () => {
    const el = new FakeStandardVideo();
    setDocPiP({ enabled: true, element: el });
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("webkit, не активно → webkitSetPresentationMode('picture-in-picture')", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.webkitSetPresentationMode).toHaveBeenCalledWith("picture-in-picture");
  });

  it("webkit, активно → webkitSetPresentationMode('inline')", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    el.webkitPresentationMode = "picture-in-picture";
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    act(() => {
      result.current.toggle();
    });
    expect(el.webkitSetPresentationMode).toHaveBeenCalledWith("inline");
  });

  it("отклонение requestPictureInPicture не роняет", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    el.requestPictureInPicture = vi.fn(() => Promise.reject(new Error("denied")));
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(() => {
      act(() => {
        result.current.toggle();
      });
    }).not.toThrow();
  });
});

describe("usePictureInPicture — active и cleanup", () => {
  it("active синхронизируется по enterpictureinpicture", () => {
    const el = new FakeStandardVideo();
    setDocPiP({ enabled: true, element: null });
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(result.current.active).toBe(false);
    setDocPiP({ enabled: true, element: el });
    act(() => {
      el.emit("enterpictureinpicture");
    });
    expect(result.current.active).toBe(true);
  });

  it("active синхронизируется по webkitpresentationmodechanged", () => {
    setDocPiP({ enabled: false });
    const el = new FakeWebkitVideo();
    const { result } = renderHook(() => usePictureInPicture(refFor(el)));
    expect(result.current.active).toBe(false);
    el.webkitPresentationMode = "picture-in-picture";
    act(() => {
      el.emit("webkitpresentationmodechanged");
    });
    expect(result.current.active).toBe(true);
  });

  it("unmount снимает слушатели", () => {
    setDocPiP({ enabled: true, element: null });
    const el = new FakeStandardVideo();
    const { unmount } = renderHook(() => usePictureInPicture(refFor(el)));
    unmount();
    expect(el.hasListeners("enterpictureinpicture")).toBe(false);
    expect(el.hasListeners("leavepictureinpicture")).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/media/ui/use-picture-in-picture.test.tsx`
Expected: FAIL — `Failed to resolve import "./use-picture-in-picture"`.

- [ ] **Step 3: Реализовать хук**

Create `src/features/media/ui/use-picture-in-picture.ts`:

```ts
"use client";
// src/features/media/ui/use-picture-in-picture.ts
import { useCallback, useEffect, useState, type RefObject } from "react";

const PIP = "picture-in-picture";

/** WebKit PiP (Safari/iOS) — нет в lib.dom, узкий локальный тип. */
interface WebkitVideo {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

function standardSupported(el: HTMLMediaElement): boolean {
  return (
    typeof document !== "undefined" &&
    document.pictureInPictureEnabled &&
    !(el as HTMLVideoElement).disablePictureInPicture
  );
}

function webkitSupported(el: HTMLMediaElement): boolean {
  const w = el as unknown as WebkitVideo;
  return (
    typeof w.webkitSupportsPresentationMode === "function" &&
    w.webkitSupportsPresentationMode(PIP)
  );
}

function isActive(el: HTMLMediaElement): boolean {
  const w = el as unknown as WebkitVideo;
  return (
    (typeof document !== "undefined" && document.pictureInPictureElement === el) ||
    w.webkitPresentationMode === PIP
  );
}

/**
 * Picture-in-Picture для видео: стандартный API + WebKit-fallback (iOS Safari).
 * Прогрессивное улучшение — `supported=false` без поддержки. Слушатели снимаются
 * на unmount.
 */
export function usePictureInPicture(
  videoRef: RefObject<HTMLMediaElement | null>,
): { supported: boolean; active: boolean; toggle: () => void } {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const std = standardSupported(el);
    const wk = webkitSupported(el);
    setSupported(std || wk);
    if (!std && !wk) return;

    const sync = (): void => {
      setActive(isActive(el));
    };
    sync();
    el.addEventListener("enterpictureinpicture", sync);
    el.addEventListener("leavepictureinpicture", sync);
    el.addEventListener("webkitpresentationmodechanged", sync);

    return () => {
      el.removeEventListener("enterpictureinpicture", sync);
      el.removeEventListener("leavepictureinpicture", sync);
      el.removeEventListener("webkitpresentationmodechanged", sync);
    };
  }, [videoRef]);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const w = el as unknown as WebkitVideo;

    if (isActive(el)) {
      if (typeof document !== "undefined" && document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {
          /* выход не удался — игнор */
        });
      } else if (typeof w.webkitSetPresentationMode === "function") {
        w.webkitSetPresentationMode("inline");
      }
      return;
    }

    if (standardSupported(el) && "requestPictureInPicture" in el) {
      (el as HTMLVideoElement).requestPictureInPicture().catch(() => {
        /* запрос отклонён (нет метаданных/запрет) — игнор */
      });
    } else if (typeof w.webkitSetPresentationMode === "function") {
      w.webkitSetPresentationMode(PIP);
    }
  }, [videoRef]);

  return { supported, active, toggle };
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/use-picture-in-picture.test.tsx`
Expected: PASS (все it зелёные).

- [ ] **Step 5: Коммит**

```bash
git add src/features/media/ui/use-picture-in-picture.ts src/features/media/ui/use-picture-in-picture.test.tsx
git commit -m "$(cat <<'EOF'
feat(media): хук usePictureInPicture (стандарт + webkit для iOS)

Детект поддержки PiP (document.pictureInPictureEnabled / webkit
webkitSupportsPresentationMode), active по событиям, toggle вход/выход
через доступный API. Прогрессивное улучшение, cleanup на unmount.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Иконка `PictureInPictureIcon` + кнопка `PipButton`

Общая SVG-иконка (по конвенции `assets/icons`) + kit-кнопка, которая рендерится только при поддержке PiP и тоглит его.

**Files:**
- Create: `src/assets/icons/picture-in-picture-icon.tsx`
- Test: `src/assets/icons/picture-in-picture-icon.test.tsx`
- Create: `src/features/media/ui/pip-button.tsx`
- Test: `src/features/media/ui/pip-button.test.tsx`

**Interfaces:**
- Consumes: `usePictureInPicture(videoRef)` (Task 1).
- Produces:
  ```ts
  export function PictureInPictureIcon(props: React.ComponentProps<"svg">): JSX.Element
  export function PipButton(props: { videoRef: RefObject<HTMLMediaElement | null> }): JSX.Element | null
  ```

- [ ] **Step 1: Написать падающий тест иконки**

Create `src/assets/icons/picture-in-picture-icon.test.tsx`:

```tsx
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PictureInPictureIcon } from "./picture-in-picture-icon";

afterEach(cleanup);

describe("PictureInPictureIcon", () => {
  it("рендерит aria-hidden svg и принимает className", () => {
    const { container } = render(<PictureInPictureIcon className="text-xl" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- иконка рендерит aria-hidden svg без роли (прецедент: chevron-icon.test.tsx)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toContain("text-xl");
  });
});
```

- [ ] **Step 2: Написать падающий тест кнопки**

Create `src/features/media/ui/pip-button.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePictureInPicture } from "./use-picture-in-picture";

vi.mock("@/i18n/client", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("./use-picture-in-picture", () => ({
  usePictureInPicture: vi.fn(),
}));

import { PipButton } from "./pip-button";

const mockHook = vi.mocked(usePictureInPicture);

function setHook(v: { supported: boolean; active: boolean; toggle: () => void }) {
  mockHook.mockReturnValue(v);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ref = { current: null };

describe("PipButton", () => {
  it("не рендерится без поддержки PiP", () => {
    setHook({ supported: false, active: false, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("рендерит кнопку при поддержке; aria-label 'pipEnter' когда не активно", () => {
    setHook({ supported: true, active: false, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.getByRole("button", { name: "pipEnter" })).toBeTruthy();
  });

  it("aria-label 'pipExit' когда активно", () => {
    setHook({ supported: true, active: true, toggle: vi.fn() });
    render(<PipButton videoRef={ref} />);
    expect(screen.getByRole("button", { name: "pipExit" })).toBeTruthy();
  });

  it("клик зовёт toggle", () => {
    const toggle = vi.fn();
    setHook({ supported: true, active: false, toggle });
    render(<PipButton videoRef={ref} />);
    fireEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Запустить тесты — убедиться, что падают**

Run: `pnpm exec vitest run src/assets/icons/picture-in-picture-icon.test.tsx src/features/media/ui/pip-button.test.tsx`
Expected: FAIL — `Failed to resolve import "./picture-in-picture-icon"` / `"./pip-button"`.

- [ ] **Step 4: Реализовать иконку**

Create `src/assets/icons/picture-in-picture-icon.tsx`:

```tsx
// Picture-in-Picture: внешний экран + малый экран в нижнем-правом углу.
export function PictureInPictureIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden {...props}>
      <path
        d="M3 5h18v14H3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="12" y="11" width="7" height="5" fill="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 5: Реализовать кнопку**

Create `src/features/media/ui/pip-button.tsx`:

```tsx
"use client";
// src/features/media/ui/pip-button.tsx
import type { RefObject } from "react";

import { PictureInPictureIcon } from "@/assets/icons/picture-in-picture-icon";
import { IconButton, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { usePictureInPicture } from "./use-picture-in-picture";

interface PipButtonProps {
  videoRef: RefObject<HTMLMediaElement | null>;
}

/** Кнопка Picture-in-Picture для видео. Рендерится только при поддержке PiP. */
export function PipButton({ videoRef }: PipButtonProps) {
  const t = useT("media");
  const { supported, active, toggle } = usePictureInPicture(videoRef);
  if (!supported) return null;
  return (
    <Inline>
      <IconButton
        tone="neutral"
        compact
        onClick={toggle}
        aria-label={active ? t("pipExit") : t("pipEnter")}
      >
        <PictureInPictureIcon />
      </IconButton>
    </Inline>
  );
}
```

- [ ] **Step 6: Запустить тесты — убедиться, что проходят**

Run: `pnpm exec vitest run src/assets/icons/picture-in-picture-icon.test.tsx src/features/media/ui/pip-button.test.tsx`
Expected: PASS.

- [ ] **Step 7: Проверить, что `Inline` экспортируется из kit**

Run: `grep -n "Inline" src/components/ui/index.ts`
Expected: строка `export { Inline, INLINE_CLASS, type InlineProps } ...` присутствует (импорт `Inline` в pip-button.tsx валиден). Если её нет — STOP, сообщить контроллеру (kit — frozen, добавлять примитив отдельным PR нельзя).

- [ ] **Step 8: Коммит**

```bash
git add src/assets/icons/picture-in-picture-icon.tsx src/assets/icons/picture-in-picture-icon.test.tsx src/features/media/ui/pip-button.tsx src/features/media/ui/pip-button.test.tsx
git commit -m "$(cat <<'EOF'
feat(media): PictureInPictureIcon + kit-кнопка PipButton

Общая SVG-иконка по конвенции assets/icons + IconButton, которая
рендерится только при supported и тоглит PiP. aria-label по active.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Проводка в `MediaPlayer` + i18n-ключи

Повесить `PipButton` в video-ветку плеера и добавить i18n-ключи `pipEnter`/`pipExit` (ru+en). Расширить интеграционный тест плеера.

**Files:**
- Modify: `src/features/media/ui/media-player.tsx`
- Modify: `src/features/media/ui/media-player.test.tsx`
- Modify: `src/i18n/messages/ru/media.ts`
- Modify: `src/i18n/messages/en/media.ts`

**Interfaces:**
- Consumes: `PipButton` (Task 2).
- Produces: video-ветка `MediaPlayer` рендерит `<PipButton videoRef={ref} />` под `<video>`.

- [ ] **Step 1: Добавить i18n-ключи (ru + en)**

In `src/i18n/messages/ru/media.ts`, в блок `// --- плеер ---` (после `playerArtist`) добавить:

```ts
  // --- плеер ---
  playerArtist: "Философия ликбез",
  pipEnter: "Картинка в картинке",
  pipExit: "Выйти из картинки в картинке",
```

In `src/i18n/messages/en/media.ts`, в блок `// --- player ---` (после `playerArtist`) добавить:

```ts
  // --- player ---
  playerArtist: "Философия ликбез",
  pipEnter: "Picture in picture",
  pipExit: "Exit picture in picture",
```

- [ ] **Step 2: Расширить интеграционный тест плеера**

In `src/features/media/ui/media-player.test.tsx`, добавить в КОНЕЦ файла (после существующего `describe("MediaPlayer + mediaSession", …)`) новый блок. Он стабит стандартный PiP, чтобы `PipButton` отрендерился на реальном jsdom-`<video>`:

```tsx
describe("MediaPlayer + Picture-in-Picture", () => {
  beforeEach(() => {
    Object.defineProperty(document, "pictureInPictureEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(document, "pictureInPictureElement", {
      configurable: true,
      value: null,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "pictureInPictureEnabled");
    Reflect.deleteProperty(document, "pictureInPictureElement");
  });

  it("video с поддержкой PiP → есть кнопка pipEnter", () => {
    render(
      <MediaPlayer url="https://x/v.mp4" type="video" filename="lecture-1.mp4" mediaId="m1" />,
    );
    expect(screen.getByRole("button", { name: "pipEnter" })).toBeTruthy();
  });

  it("audio → кнопки PiP нет (видео-only)", () => {
    render(
      <MediaPlayer url="https://x/a.mp3" type="audio" filename="lecture.mp3" mediaId="m2" />,
    );
    expect(screen.queryByRole("button", { name: "pipEnter" })).toBeNull();
  });
});
```

- [ ] **Step 3: Запустить тест плеера — убедиться, что новый блок падает**

Run: `pnpm exec vitest run src/features/media/ui/media-player.test.tsx`
Expected: FAIL — в новом блоке `getByRole("button", { name: "pipEnter" })` не находит кнопку (MediaPlayer ещё не рендерит `PipButton`).

- [ ] **Step 4: Подключить `PipButton` в `MediaPlayer`**

In `src/features/media/ui/media-player.tsx`:

1. Добавить импорт (в группу относительных импортов, рядом с хуками):

```tsx
import { PipButton } from "./pip-button";
```

2. Заменить video-ветку `return` на обёртку с кнопкой под видео:

```tsx
  if (type === "video") {
    return (
      <div className="flex flex-col gap-2">
        <video
          ref={setRef}
          controls
          preload="metadata"
          className="w-full max-h-[70vh] rounded bg-black"
          aria-label={filename}
        >
          <source src={url} />
          <track kind="captions" />
          {t("videoBrowserFallback")}
        </video>
        <PipButton videoRef={ref} />
      </div>
    );
  }
```

(Аудио-ветку НЕ трогать.)

- [ ] **Step 5: Запустить тест плеера — убедиться, что проходит**

Run: `pnpm exec vitest run src/features/media/ui/media-player.test.tsx`
Expected: PASS (новый PiP-блок + существующие mediaSession-тесты зелёные — у `<video>` сохранён `aria-label`, getByLabelText/toBeInstanceOf по-прежнему находят его).

- [ ] **Step 6: Прогнать фичу + i18n целиком**

Run: `pnpm exec vitest run src/features/media src/i18n`
Expected: PASS (включая i18n-паритет ru/en с новыми ключами).

- [ ] **Step 7: Коммит**

```bash
git add src/features/media/ui/media-player.tsx src/features/media/ui/media-player.test.tsx src/i18n/messages/ru/media.ts src/i18n/messages/en/media.ts
git commit -m "$(cat <<'EOF'
feat(media): подключить PipButton к video в MediaPlayer + i18n

Video-ветка плеера рендерит PipButton под <video>; i18n-ключи
pipEnter/pipExit (ru+en). Аудио-ветка не тронута.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Финальная проверка (после всех тасков)

- [ ] **Полный гейт перед PR**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Пороги coverage в `vitest.config.ts` не трогать.

- [ ] **Ручная браузер-приёмка** (вне CI, отметить в PR):
  - Chrome: на `/media/[id]` с видео — кнопка PiP → видео уезжает в плавающее окно; повторный клик / закрытие окна → состояние кнопки синхронно; окно переживает сворачивание/вкладки.
  - Safari (десктоп) и iOS Safari: та же кнопка работает (на iOS — через webkit presentation mode; видео продолжает играть при уходе из приложения).
  - Браузер без PiP (например, Firefox использует свой UI) → нашей кнопки нет, плеер работает как раньше, без ошибок в консоли.
  - Аудио-страница → кнопки PiP нет.

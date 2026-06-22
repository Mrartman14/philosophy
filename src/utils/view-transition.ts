import { isReducedMotion } from "@/components/appearance/is-reduced-motion";
import type { Motion } from "@/styles/tokens/enums";

interface Point { x: number; y: number }

export interface ViewTransitionOpts {
  origin?: Point;
  duration?: number;
  easing?: string;
  name?: string;
}

type VTCapableDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<unknown> };
};

// Последняя точка указателя — origin кругового reveal по умолчанию. Capture-фаза
// гарантирует, что pointerdown триггерящего клика записан ДО React-обработчика.
let lastPointer: Point | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => { lastPointer = { x: e.clientX, y: e.clientY }; },
    { capture: true, passive: true },
  );
}

function reducedNow(): boolean {
  const motion = (document.documentElement.dataset.motion as Motion | undefined) ?? "system";
  const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return isReducedMotion({ motion, osReduce });
}

function readNumberToken(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
  if (raw.endsWith("s")) return (parseFloat(raw) || fallback / 1000) * 1000;
  return fallback;
}

function readStringToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Оборачивает СИНХРОННУЮ DOM-мутацию в круговой View-Transition reveal.
 * Фолбэк (нет VT ИЛИ движение приглушено) — просто вызвать mutate (мгновенно).
 * flushSync не нужен: потребитель сам синхронно мутирует DOM в mutate.
 */
export function withViewTransition(mutate: () => void, opts: ViewTransitionOpts = {}): void {
  const doc = document as VTCapableDocument;
  if (typeof doc.startViewTransition !== "function" || reducedNow()) {
    mutate();
    return;
  }
  const origin = opts.origin ?? lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const duration = opts.duration ?? readNumberToken("--vt-duration", 400);
  const easing = opts.easing ?? readStringToken("--vt-easing", "ease-in-out");

  const transition = doc.startViewTransition(mutate);
  void transition.ready.then(() => {
    const end = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${origin.x}px ${origin.y}px)`,
          `circle(${end}px at ${origin.x}px ${origin.y}px)`,
        ],
      },
      { duration, easing, pseudoElement: "::view-transition-new(root)" },
    );
  });
}

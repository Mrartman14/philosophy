import type { Motion } from "@/styles/tokens/enums";

import { isReducedMotion } from "./is-reduced-motion";

interface Point { x: number; y: number }

export interface ViewTransitionOpts {
  origin?: Point;
  duration?: number;
  easing?: string;
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
  const scale = raw.endsWith("ms") ? 1 : raw.endsWith("s") ? 1000 : null;
  if (scale === null) return fallback;
  const parsed = parseFloat(raw);
  // NaN (пусто/мусор) → fallback; отрицательная длительность недопустима для
  // WAAPI → 0. Явный Number.isNaN вместо `|| fallback`: иначе валидный 0ms-токен
  // ложно резолвился бы в fallback (0 — falsy).
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, parsed * scale);
}

function readStringToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Оборачивает СИНХРОННУЮ DOM-мутацию в круговой View-Transition reveal.
 * Фолбэк (нет VT ИЛИ движение приглушено) — просто вызвать mutate (мгновенно).
 *
 * flushSync не нужен, ПОТОМУ ЧТО потребитель мутирует DOM императивно (applyToHtml),
 * а не через React-рендер: внутри VT-колбэка изменение уже применено синхронно.
 * Будущий render-driven переход (напр. shared-element list→detail) ПОТРЕБУЕТ flushSync,
 * чтобы React успел закоммитить DOM до снимка VT.
 *
 * mutate гарантированно вызывается ровно один раз на любом пути (run-once guard):
 * синхронный throw из startViewTransition не должен «съесть» мутацию, а успешный
 * запуск VT уже исполнил mutate внутри колбэка.
 */
export function withViewTransition(mutate: () => void, opts: ViewTransitionOpts = {}): void {
  // Run-once guard: делает двойное исполнение mutate структурно невозможным.
  let mutated = false;
  const runMutateOnce = () => {
    if (mutated) return;
    mutated = true;
    mutate();
  };

  const doc = document as VTCapableDocument;
  if (typeof doc.startViewTransition !== "function" || reducedNow()) {
    runMutateOnce();
    return;
  }
  const origin = opts.origin ?? lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const duration = opts.duration ?? readNumberToken("--vt-duration", 400);
  const easing = opts.easing ?? readStringToken("--vt-easing", "ease-in-out");

  let transition: { ready: Promise<unknown> };
  try {
    transition = doc.startViewTransition(runMutateOnce);
  } catch {
    // startViewTransition бросил синхронно → колбэк не исполнился. Применяем
    // мутацию вручную (тема не должна молча отвалиться) и выходим без reveal.
    runMutateOnce();
    return;
  }
  // ready РЕДЖЕКТИТСЯ, когда браузер пропускает/вытесняет переход (напр. быстрый
  // ретогл темы внутри окна reveal). DOM уже мутирован внутри VT-колбэка, так что
  // пропуск стоит лишь косметического reveal — глушим, чтобы не было unhandled rejection.
  void transition.ready
    .then(() => {
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
    })
    .catch(() => {
      // Намеренно проглочено: см. комментарий выше (косметический reveal потерян).
    });
}

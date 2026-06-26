// src/features/canvas/editor/interaction.ts
// Чистые хелперы развилки ввода: pointer-жесты, колесо, nudge. Без React/DOM —
// тестируются изолированно; canvas-editor.tsx лишь подставляет сюда поля событий.
import { ZOOM_IN, ZOOM_OUT } from "./coords";
import type { CanvasTool } from "./editor-types";

export interface GestureInput {
  tool: CanvasTool;
  spaceHeld: boolean;
  /** PointerEvent.button: 0 — левая, 1 — средняя, 2 — правая. */
  button: number;
  /** PointerEvent.pointerType: "mouse" | "pen" | "touch". */
  pointerType: string;
  shift: boolean;
}

/** Жест при pointerdown по пустому фону. */
export function resolveBackgroundGesture(i: GestureInput): "pan" | "marquee" {
  if (i.button === 1 || i.tool === "hand" || i.spaceHeld) return "pan";
  if (i.pointerType === "touch") return "pan"; // один палец = пан (десктоп-first)
  return "marquee";
}

/** Жест при pointerdown по узлу. */
export function resolveNodeGesture(i: GestureInput): "select-move" | "pan" {
  if (i.button === 1 || i.tool === "hand" || i.spaceHeld) return "pan";
  return "select-move";
}

export interface WheelInput {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type WheelAction = { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number };

/** Figma-конвенция: ctrl/meta (и пинч=ctrl+wheel) → зум; иначе → пан. */
export function resolveWheel(i: WheelInput): WheelAction {
  if (i.ctrlKey || i.metaKey) {
    return { kind: "zoom", factor: i.deltaY < 0 ? ZOOM_IN : ZOOM_OUT };
  }
  if (i.shiftKey && i.deltaX === 0) {
    return { kind: "pan", dx: i.deltaY, dy: 0 }; // колесо мыши + shift = горизонталь
  }
  return { kind: "pan", dx: i.deltaX, dy: i.deltaY };
}

const SMALL_NUDGE = 1;
const BIG_NUDGE = 10;

/** Стрелка → дельта перемещения (world px). Не-стрелка → null. */
export function resolveNudge(key: string, shift: boolean): { dx: number; dy: number } | null {
  const step = shift ? BIG_NUDGE : SMALL_NUDGE;
  switch (key) {
    case "ArrowLeft": return { dx: -step, dy: 0 };
    case "ArrowRight": return { dx: step, dy: 0 };
    case "ArrowUp": return { dx: 0, dy: -step };
    case "ArrowDown": return { dx: 0, dy: step };
    default: return null;
  }
}

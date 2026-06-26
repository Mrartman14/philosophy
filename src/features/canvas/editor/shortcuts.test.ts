// src/features/canvas/editor/shortcuts.test.ts
import { describe, it, expect, vi } from "vitest";

import { runShortcuts, hasMod, type Shortcut, type KeyLike } from "./shortcuts";

function ev(over: Partial<KeyLike> = {}): KeyLike & { preventDefault: () => void } {
  return { key: "", code: "", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), ...over };
}

describe("runShortcuts", () => {
  it("combo с точными модификаторами; Shift+1 матчится по e.code (раскладка)", () => {
    const run = vi.fn();
    const sc: Shortcut[] = [{ id: "fit", combo: "Shift+1", run }];
    // Shift+1 на US-раскладке даёт key="!", но code="Digit1"
    const e = ev({ key: "!", code: "Digit1", shiftKey: true });
    expect(runShortcuts(sc, e)).toBe("fit");
    expect(run).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalled();
  });
  it("Mod = ctrl ИЛИ meta; лишние модификаторы не матчатся", () => {
    const sc: Shortcut[] = [{ id: "undo", combo: "Mod+z", run: vi.fn() }];
    expect(runShortcuts(sc, ev({ key: "z", code: "KeyZ", metaKey: true }))).toBe("undo");
    expect(runShortcuts(sc, ev({ key: "z", code: "KeyZ", ctrlKey: true }))).toBe("undo");
    expect(runShortcuts(sc, ev({ key: "z", code: "KeyZ" }))).toBeNull(); // без mod
    expect(runShortcuts(sc, ev({ key: "z", code: "KeyZ", metaKey: true, shiftKey: true }))).toBeNull(); // лишний shift
  });
  it("redo (Mod+Shift+z) и undo (Mod+z) не пересекаются", () => {
    const undo = vi.fn(), redo = vi.fn();
    const sc: Shortcut[] = [
      { id: "redo", combo: "Mod+Shift+z", run: redo },
      { id: "undo", combo: "Mod+z", run: undo },
    ];
    runShortcuts(sc, ev({ key: "z", code: "KeyZ", metaKey: true, shiftKey: true }));
    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });
  it("when-предикат (shift-агностичный) + preventDefault:false", () => {
    const run = vi.fn();
    const sc: Shortcut[] = [{ id: "tool", when: (e) => !hasMod(e) && e.key.toLowerCase() === "v", run, preventDefault: false }];
    const e = ev({ key: "V", shiftKey: true });
    expect(runShortcuts(sc, e)).toBe("tool");
    expect(run).toHaveBeenCalledOnce();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it("первый подходящий выигрывает; ничего не совпало → null", () => {
    const a = vi.fn(), b = vi.fn();
    const sc: Shortcut[] = [{ id: "a", combo: "Delete", run: a }, { id: "b", combo: "Delete", run: b }];
    expect(runShortcuts(sc, ev({ key: "Delete", code: "Delete" }))).toBe("a");
    expect(b).not.toHaveBeenCalled();
    expect(runShortcuts(sc, ev({ key: "x", code: "KeyX" }))).toBeNull();
  });
});

// src/features/canvas/editor/shortcuts.ts
// Лёгкий реестр команд+шорткатов: декларативный список {combo|when, run} + один
// диспетчер на keydown (вместо разросшегося switch). Чистый и тестируемый — UI
// строит реестр со своими хендлерами и зовёт runShortcuts из onKeyDown.

/** Минимальный срез KeyboardEvent, нужный для матчинга (удобно для тестов). */
export interface KeyLike {
  key: string;
  code: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Mod = Ctrl (Win/Linux) ИЛИ Cmd (mac) — принимаем любой, кроссплатформенно. */
export function hasMod(e: KeyLike): boolean {
  return e.ctrlKey || e.metaKey;
}

interface Chord {
  shift: boolean;
  alt: boolean;
  mod: boolean;
  /** Токен основной (последней) клавиши, напр. "z" / "1" / "Delete" / "]". */
  key: string;
}

/** "Mod+Shift+z" / "Shift+1" / "Delete" / "]" → аккорд (регистр модификаторов не важен). */
function parseCombo(combo: string): Chord {
  const parts = combo.split("+");
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());
  return {
    shift: mods.includes("shift"),
    alt: mods.includes("alt"),
    mod: mods.includes("mod"),
    key: parts[parts.length - 1] ?? "",
  };
}

/**
 * Токен клавиши матчится по e.key ИЛИ e.code (коды вида Key.. / Digit..) — устойчиво
 * к раскладке (Shift+1 даёт e.key="!", но e.code="Digit1") и к именам (Delete/Space).
 */
function keyMatches(token: string, e: KeyLike): boolean {
  const t = token.toLowerCase();
  const k = e.key.toLowerCase();
  const c = e.code.toLowerCase();
  return k === t || c === t || c === "key" + t || c === "digit" + t;
}

function matchesChord(chord: Chord, e: KeyLike): boolean {
  return (
    chord.shift === e.shiftKey &&
    chord.alt === e.altKey &&
    chord.mod === hasMod(e) &&
    keyMatches(chord.key, e)
  );
}

export interface Shortcut {
  /** Идентификатор команды (отладка/тесты). */
  id: string;
  /** Комбо "Mod+z" / "Shift+1" / "Delete". Взаимоисключимо с when. */
  combo?: string;
  /** Произвольный предикат — для shift-агностичных/параметрических (нудж, v/h). */
  when?: (e: KeyLike) => boolean;
  /** Обработчик; получает событие (может читать shiftKey/key). */
  run: (e: KeyLike) => void;
  /** preventDefault по умолчанию true. */
  preventDefault?: boolean;
}

/**
 * Находит ПЕРВЫЙ подходящий шорткат (порядок = приоритет), гасит дефолт (если не
 * отключён) и запускает его. Возвращает id сработавшей команды или null.
 */
export function runShortcuts(shortcuts: Shortcut[], e: KeyLike & { preventDefault: () => void }): string | null {
  for (const s of shortcuts) {
    const matched = s.combo ? matchesChord(parseCombo(s.combo), e) : s.when ? s.when(e) : false;
    if (!matched) continue;
    if (s.preventDefault !== false) e.preventDefault();
    s.run(e);
    return s.id;
  }
  return null;
}

// Псевдолокализация: алгоритмическая трансформация каталога для ВИЗУАЛЬНОГО
// тестирования лейаута (экспансия текста ~+40%, отлов усечения и захардкоженных
// строк). Client-safe, без next/server — как format.ts/resolve.ts.
//
// ICU-безопасна BY CONSTRUCTION: акцентируются только буквы ВНЕ `{…}`-групп;
// плейсхолдеры (`{name}`), plural-блоки и `#` копируются дословно; добавляется
// лишь литеральный текст (маркеры ⟦…⟧ + филлер). Трансформ никогда не добавляет
// и не убирает фигурные скобки → валидный ICU остаётся валидным.

const ACCENTS: Record<string, string> = {
  a: "á", b: "ḃ", c: "ċ", d: "ḋ", e: "é", f: "ḟ", g: "ġ", h: "ĥ",
  i: "í", j: "ĵ", k: "ķ", l: "ļ", m: "ṁ", n: "ñ", o: "ó", p: "ṗ",
  q: "q̇", r: "ŕ", s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ",
  y: "ý", z: "ž",
  A: "Á", B: "Ḃ", C: "Ċ", D: "Ḋ", E: "É", F: "Ḟ", G: "Ġ", H: "Ĥ",
  I: "Í", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ó", P: "Ṗ",
  Q: "Q̇", R: "Ŕ", S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ",
  Y: "Ý", Z: "Ž",
};

// Филлер экспансии — буквы без ICU-спецсимволов ({ } # ').
const FILLER = "áéíóúàèìòù";

/**
 * Псевдолокализует одну строку: акцент латинских букв вне `{…}`, экспансия длины,
 * обёртка в маркеры. Плейсхолдеры и plural-блоки сохраняются дословно.
 */
export function pseudoizeString(input: string): string {
  let depth = 0;
  let body = "";
  let freeLetters = 0; // буквы вне скобок — база для расчёта экспансии

  for (const ch of input) {
    if (ch === "{") {
      depth++;
      body += ch;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      body += ch;
    } else if (depth === 0) {
      const accented = ACCENTS[ch];
      if (accented !== undefined) {
        body += accented;
        freeLetters++;
      } else {
        body += ch;
      }
    } else {
      body += ch; // внутри `{…}` — дословно
    }
  }

  const padLen = Math.max(1, Math.ceil(freeLetters * 0.4));
  let pad = "";
  for (let i = 0; i < padLen; i++) pad += FILLER.charAt(i % FILLER.length);

  return `⟦${body} ${pad}⟧`;
}

/** Глубоко псевдолокализует каталог: строки → pseudoizeString, ключи/вложенность сохраняются. Не мутирует вход. */
export function pseudoizeCatalog<T>(node: T): T {
  if (typeof node === "string") return pseudoizeString(node) as T;
  if (node !== null && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = pseudoizeCatalog(value);
    }
    return out as T;
  }
  return node;
}

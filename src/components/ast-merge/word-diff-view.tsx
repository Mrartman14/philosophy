import type { DiffToken } from "./types";

/** Рендер пословного diff: add — зелёным, del — красным зачёркнутым. */
export function WordDiffView({ tokens }: { tokens: DiffToken[] }) {
  return (
    <p className="whitespace-pre-wrap text-sm">
      {tokens.map((tok, i) => {
        if (tok.type === "add") {
          return (
            <span key={i} className="rounded-sm bg-green-100 text-green-800">
              {tok.text}
            </span>
          );
        }
        if (tok.type === "del") {
          return (
            <span
              key={i}
              className="rounded-sm bg-red-100 text-red-800 line-through"
            >
              {tok.text}
            </span>
          );
        }
        return <span key={i}>{tok.text}</span>;
      })}
    </p>
  );
}

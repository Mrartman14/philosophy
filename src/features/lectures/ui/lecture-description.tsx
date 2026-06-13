"use client";
import { useEffect, useState } from "react";
import { suggestGlossaryTerms } from "../actions";
import {
  byteRangeToCodeUnits,
  segmentWithHighlights,
  type HighlightRange,
} from "../suggest-highlight";

interface Props {
  description: string;
  /** Стабильный id блока описания для запроса suggest. */
  blockId?: string;
}

/**
 * Описание лекции с подсветкой терминов глоссария. Грузит suggest на клиенте
 * (requiredAuth — гостю вернётся forbidden, тихо показываем plain-текст).
 * Конвертирует байтовые offset бека → UTF-16 (suggest-highlight.ts).
 * Прогрессивное улучшение: до ответа и при ошибке — обычный текст.
 */
export function LectureDescription({
  description,
  blockId = "lecture-description",
}: Props) {
  const [ranges, setRanges] = useState<HighlightRange[]>([]);

  useEffect(() => {
    if (!description) return;
    let cancelled = false;
    void (async () => {
      const r = await suggestGlossaryTerms({
        blocks: [{ block_id: blockId, text: description }],
      });
      if (cancelled || !r.success) return;
      const next: HighlightRange[] = [];
      for (const sug of r.data) {
        for (const occ of sug.occurrences ?? []) {
          if (occ.block_id !== blockId) continue;
          if (typeof occ.offset !== "number" || typeof occ.length !== "number") {
            continue;
          }
          const { start, end } = byteRangeToCodeUnits(
            description,
            occ.offset,
            occ.length,
          );
          if (start < end) {
            next.push({
              start,
              end,
              termId: sug.term_id ?? "",
              title: sug.title ?? "",
            });
          }
        }
      }
      setRanges(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [description, blockId]);

  const segments = segmentWithHighlights(description, ranges);

  return (
    <div className="whitespace-pre-wrap text-base">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            title={seg.highlight.title}
            data-term-id={seg.highlight.termId}
            className="rounded bg-(--color-text-pane) px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </div>
  );
}

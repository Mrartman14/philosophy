"use client";

import { useState, useTransition } from "react";
import type { Segment } from "@/api/types";
import {
  addSegment,
  deleteSegment,
  updateSegment,
} from "@/features/admin/actions";

interface TranscriptEditorProps {
  lectureId: string;
  initialSegments: Segment[];
}

interface NewSegmentDraft {
  position: string;
  start: string;
  end: string;
  speaker: string;
  text: string;
}

const emptyDraft: NewSegmentDraft = {
  position: "",
  start: "",
  end: "",
  speaker: "",
  text: "",
};

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  lectureId,
  initialSegments,
}) => {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [draft, setDraft] = useState<NewSegmentDraft>(emptyDraft);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    setError(null);
    const position = Number(draft.position);
    const start = Number(draft.start);
    const end = Number(draft.end);
    if (!draft.speaker || !draft.text.trim()) {
      setError("Заполните speaker и text");
      return;
    }
    if (Number.isNaN(position) || Number.isNaN(start) || Number.isNaN(end)) {
      setError("position/start/end должны быть числами");
      return;
    }

    startTransition(async () => {
      const result = await addSegment({
        lectureId,
        position,
        start,
        end,
        speaker: draft.speaker,
        text: draft.text,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Оптимистично добавляем в UI (без id — пользователь увидит после reload)
      // Проще сказать пользователю перезагрузить.
      setDraft(emptyDraft);
      setError("Сегмент добавлен. Обновите страницу, чтобы увидеть его.");
    });
  };

  const handleUpdate = (
    segment: Segment,
    patch: Partial<Pick<Segment, "speaker" | "text" | "start" | "end" | "position">>
  ) => {
    setError(null);
    setSegments((prev) =>
      prev.map((s) => (s.id === segment.id ? { ...s, ...patch } : s))
    );
    startTransition(async () => {
      const result = await updateSegment({
        lectureId,
        segmentId: segment.id,
        ...patch,
      });
      if (!result.success) setError(result.error);
    });
  };

  const handleDelete = (segment: Segment) => {
    if (!confirm("Удалить сегмент?")) return;
    setError(null);
    setSegments((prev) => prev.filter((s) => s.id !== segment.id));
    startTransition(async () => {
      const result = await deleteSegment({
        lectureId,
        segmentId: segment.id,
      });
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="border border-(--color-border) rounded-lg p-4 flex flex-col gap-4">
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {segments.length === 0 ? (
        <p className="text-sm text-(--color-description)">Транскрипт пуст.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-(--color-description)">
              <tr>
                <th className="px-2 py-1 w-16">Pos</th>
                <th className="px-2 py-1 w-20">Start</th>
                <th className="px-2 py-1 w-20">End</th>
                <th className="px-2 py-1 w-32">Speaker</th>
                <th className="px-2 py-1">Text</th>
                <th className="px-2 py-1 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <SegmentRow
                  key={segment.id}
                  segment={segment}
                  pending={pending}
                  onUpdate={(patch) => handleUpdate(segment, patch)}
                  onDelete={() => handleDelete(segment)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-(--color-border) pt-3">
        <h3 className="text-sm font-semibold">Добавить сегмент</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input
            type="number"
            placeholder="position"
            value={draft.position}
            onChange={(e) => setDraft({ ...draft, position: e.target.value })}
            className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="start"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="end"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-sm"
          />
          <input
            type="text"
            placeholder="speaker"
            value={draft.speaker}
            onChange={(e) => setDraft({ ...draft, speaker: e.target.value })}
            className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="px-3 py-1 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
        <textarea
          placeholder="text"
          value={draft.text}
          rows={2}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          className="px-2 py-1 border border-(--color-border) rounded bg-transparent text-sm resize-none"
        />
      </div>
    </div>
  );
};

interface SegmentRowProps {
  segment: Segment;
  pending: boolean;
  onUpdate: (
    patch: Partial<Pick<Segment, "speaker" | "text" | "start" | "end" | "position">>
  ) => void;
  onDelete: () => void;
}

const SegmentRow: React.FC<SegmentRowProps> = ({
  segment,
  pending,
  onUpdate,
  onDelete,
}) => {
  return (
    <tr className="border-t border-(--color-border) align-top">
      <td className="px-2 py-1">
        <input
          type="number"
          defaultValue={segment.position ?? 0}
          onBlur={(e) => {
            const position = Number(e.target.value);
            if (position !== segment.position) onUpdate({ position });
          }}
          className="w-full px-1 py-0.5 border border-transparent hover:border-(--color-border) rounded bg-transparent text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          defaultValue={segment.start ?? 0}
          onBlur={(e) => {
            const start = Number(e.target.value);
            if (start !== segment.start) onUpdate({ start });
          }}
          className="w-full px-1 py-0.5 border border-transparent hover:border-(--color-border) rounded bg-transparent text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          defaultValue={segment.end ?? 0}
          onBlur={(e) => {
            const end = Number(e.target.value);
            if (end !== segment.end) onUpdate({ end });
          }}
          className="w-full px-1 py-0.5 border border-transparent hover:border-(--color-border) rounded bg-transparent text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          defaultValue={segment.speaker}
          onBlur={(e) => {
            const speaker = e.target.value;
            if (speaker !== segment.speaker) onUpdate({ speaker });
          }}
          className="w-full px-1 py-0.5 border border-transparent hover:border-(--color-border) rounded bg-transparent text-sm"
        />
      </td>
      <td className="px-2 py-1">
        <textarea
          defaultValue={segment.text}
          rows={2}
          onBlur={(e) => {
            const text = e.target.value;
            if (text !== segment.text) onUpdate({ text });
          }}
          className="w-full px-1 py-0.5 border border-transparent hover:border-(--color-border) rounded bg-transparent text-sm resize-none"
        />
      </td>
      <td className="px-2 py-1">
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="px-2 py-0.5 text-xs border border-red-500 text-red-500 rounded disabled:opacity-50"
        >
          ×
        </button>
      </td>
    </tr>
  );
};

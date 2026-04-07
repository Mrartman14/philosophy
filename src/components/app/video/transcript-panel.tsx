// src/components/app/video/transcript-panel.tsx
"use client";

import { useEffect, useRef } from "react";
import { TranscriptItem } from "@/entities/video-lecture";

interface TranscriptPanelProps {
  transcript: TranscriptItem[];
  currentTranscriptId: number | null;
  onSeek: (time: number) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcript,
  currentTranscriptId,
  onSeek,
}) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTranscriptId]);

  return (
    <div className="flex flex-col gap-1 p-4">
      {transcript.map((item) => {
        const isActive = item.id === currentTranscriptId;
        return (
          <button
            key={item.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSeek(item.start)}
            className={`text-left p-2 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? "bg-(--color-primary)/10 border-l-2 border-(--color-primary)"
                : "hover:bg-(--color-border)/30"
            }`}
          >
            <span className="text-xs text-(--description) block">
              {item.speaker}
            </span>
            <span className="text-sm">{item.text}</span>
          </button>
        );
      })}
    </div>
  );
};

"use client";

import { useRef, type ReactNode } from "react";
import { useSyncedPlayer } from "@/hooks/use-synced-player";
import { TranscriptHighlighter } from "@/components/app/video/transcript-highlighter";

type SegmentTiming = { id?: number | undefined; start?: number | undefined; end?: number | undefined };

interface LectureSyncProps {
  videoUrl: string | undefined;
  segments: SegmentTiming[];
  transcriptContent: ReactNode;
  infoContent: ReactNode;
}

export const LectureSync: React.FC<LectureSyncProps> = ({
  videoUrl,
  segments,
  transcriptContent,
  infoContent,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentSegmentId, seekTo } = useSyncedPlayer(videoRef, segments);

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptHighlighter
          currentSegmentId={currentSegmentId}
          onSeek={seekTo}
        >
          {transcriptContent}
        </TranscriptHighlighter>
      </div>
      <div className="order-1 md:order-2 md:sticky md:top-(--header-height) md:h-[calc(100vh-var(--header-height))] md:overflow-y-auto border-l border-(--color-border)">
        {videoUrl ? (
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video"
            src={videoUrl}
            preload="metadata"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-(--color-text-pane) text-(--color-description)">
            Видео недоступно
          </div>
        )}
        {infoContent}
      </div>
    </div>
  );
};

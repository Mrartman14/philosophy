"use client";

import { useRef, useState, type ReactNode } from "react";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/app/video-player/video-player";
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
  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null);

  const seekTo = (time: number) => {
    playerRef.current?.seekTo(time);
  };

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
          <VideoPlayer
            ref={playerRef}
            src={videoUrl}
            onTimeUpdate={(time) => {
              const segment = segments.find((s) => time >= (s.start ?? 0) && time <= (s.end ?? 0));
              setCurrentSegmentId(segment?.id ?? null);
            }}
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

"use client";

import { useRef } from "react";
import type { components } from "@/api/schema";
import { useSyncedPlayer } from "@/hooks/use-synced-player";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";

type Lecture = components["schemas"]["lecture.Lecture"];
type Segment = components["schemas"]["transcript.Segment"];

interface LecturePlayerProps {
  lecture: Lecture;
  segments: Segment[];
}

export const LecturePlayer: React.FC<LecturePlayerProps> = ({
  lecture,
  segments,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentSegmentId, seekTo } = useSyncedPlayer(videoRef, segments);

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptPanel
          segments={segments}
          currentSegmentId={currentSegmentId}
          onSeek={seekTo}
        />
      </div>
      <div className="order-1 md:order-2 md:sticky md:top-(--header-height) md:h-[calc(100vh-var(--header-height))] md:overflow-y-auto border-l border-(--border)">
        {lecture.video_url ? (
          <video
            ref={videoRef}
            controls
            className="w-full aspect-video"
            src={lecture.video_url}
            preload="metadata"
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-(--text-pane) text-(--description)">
            Видео недоступно
          </div>
        )}
        <div className="p-4">
          <h1 className="text-xl font-bold">{lecture.title}</h1>
          {lecture.description && (
            <p className="text-sm text-(--description) mt-2">
              {lecture.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

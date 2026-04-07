// src/app/video/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { VideoLectureData } from "@/entities/video-lecture";
import { useSyncedPlayer } from "@/components/app/video/use-synced-player";
import { TranscriptPanel } from "@/components/app/video/transcript-panel";
import { BoardPanel } from "@/components/app/video/board-panel";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function VideoPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<VideoLectureData | null>(null);

  useEffect(() => {
    fetch(`${basePath}/cutted.json`)
      .then((res) => res.json())
      .then(setData);
  }, []);

  const { currentTranscriptId, currentBoardState, seekTo } = useSyncedPlayer(
    videoRef,
    data
  );

  if (!data) {
    return <div className="p-8 text-center text-(--description)">Загрузка...</div>;
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_1fr] min-h-screen">
      {/* Left: Transcript (scrollable) */}
      <div className="order-2 md:order-1 overflow-y-auto md:max-h-screen">
        <TranscriptPanel
          transcript={data.transcript}
          currentTranscriptId={currentTranscriptId}
          onSeek={seekTo}
        />
      </div>

      {/* Right: Video + Board (sticky) */}
      <div className="order-1 md:order-2 md:sticky md:top-0 md:h-screen md:overflow-y-auto border-l border-(--border)">
        <video
          ref={videoRef}
          controls
          className="w-full aspect-video"
          src={`${basePath}/cutted.mp4`}
          preload="metadata"
        />
        <BoardPanel boardState={currentBoardState} />
      </div>
    </div>
  );
}

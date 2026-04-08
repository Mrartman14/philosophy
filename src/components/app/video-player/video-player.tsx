"use client";

import { useRef, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { useVideoPlayer } from "@/hooks/use-video-player";

export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface Marker {
  time: number;
  label: string;
  content?: ReactNode;
}

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
}

interface VideoPlayerProps {
  src: string;
  chapters?: Chapter[];
  markers?: Marker[];
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({
  src,
  chapters: _chapters = [],
  markers: _markers = [],
  onTimeUpdate,
  className,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const player = useVideoPlayer(videoRef, containerRef, onTimeUpdate);

  useImperativeHandle(ref, () => ({ seekTo: player.seek }), [player.seek]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className="w-full aspect-video bg-black"
        onClick={player.togglePlay}
      />
      {/* PlayerControls — Task 4 */}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

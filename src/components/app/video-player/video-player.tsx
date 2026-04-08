"use client";

import { useRef, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { PlayerControls } from "./player-controls";

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
  chapters = [],
  markers = [],
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
      <PlayerControls
        playing={player.playing}
        currentTime={player.currentTime}
        duration={player.duration}
        buffered={player.buffered}
        chapters={chapters}
        markers={markers}
        playbackRate={player.playbackRate}
        onTogglePlay={player.togglePlay}
        onSkipBy={player.skipBy}
        onSeek={player.seek}
        onChangePlaybackRate={player.changePlaybackRate}
      />
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

"use client";

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";

export function useVideoPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  onTimeUpdate?: (time: number) => void
) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);

  // Stable ref for onTimeUpdate to avoid re-subscribing listeners on every render
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdateRef.current?.(t);
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onRateChange = () => setPlaybackRate(video.playbackRate);
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const onPipEnter = () => setIsPip(true);
    const onPipLeave = () => setIsPip(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("enterpictureinpicture", onPipEnter);
    video.addEventListener("leavepictureinpicture", onPipLeave);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("enterpictureinpicture", onPipEnter);
      video.removeEventListener("leavepictureinpicture", onPipLeave);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [videoRef]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
    },
    [videoRef]
  );

  const skipBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (video) video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
    },
    [videoRef]
  );

  const changeVolume = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (video) {
        video.volume = Math.max(0, Math.min(1, v));
        if (video.muted && v > 0) video.muted = false;
      }
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, [videoRef]);

  const changePlaybackRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = Math.max(0.25, Math.min(4, rate));
    },
    [videoRef]
  );

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, [containerRef]);

  const togglePip = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else {
      video.requestPictureInPicture().catch(() => {});
    }
  }, [videoRef]);

  // MediaSession integration
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => videoRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => videoRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekforward", () => skipBy(10));
    navigator.mediaSession.setActionHandler("seekbackward", () => skipBy(-10));
  }, [videoRef, skipBy]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const target = e.target as HTMLElement;
      // Don't handle if typing in an input
      if (target.tagName === "INPUT") return;
      // Don't intercept arrow keys when focus is inside a slider (Base UI handles them)
      if (target.closest('[role="slider"]') && e.key.startsWith("Arrow")) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipBy(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          skipBy(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(video.volume + 0.05);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(video.volume - 0.05);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "p":
          togglePip();
          break;
        case "<":
          changePlaybackRate(video.playbackRate - 0.25);
          break;
        case ">":
          changePlaybackRate(video.playbackRate + 0.25);
          break;
      }
    },
    [videoRef, togglePlay, skipBy, changeVolume, toggleMute, toggleFullscreen, togglePip, changePlaybackRate]
  );

  return {
    playing,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    playbackRate,
    togglePlay,
    seek,
    skipBy,
    changeVolume,
    toggleMute,
    changePlaybackRate,
    isFullscreen,
    isPip,
    toggleFullscreen,
    togglePip,
    handleKeyDown,
  };
}

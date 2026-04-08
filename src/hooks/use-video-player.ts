"use client";

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";

export function useVideoPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  _containerRef: RefObject<HTMLElement | null>,
  onTimeUpdate?: (time: number) => void
) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Stable ref for onTimeUpdate to avoid re-subscribing listeners on every render
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

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

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("ratechange", onRateChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("ratechange", onRateChange);
    };
  }, [videoRef]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
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
  };
}

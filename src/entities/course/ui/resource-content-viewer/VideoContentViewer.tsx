import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ExpandIcon, PauseIcon, PlayIcon } from "@/shared/ui";
import type { ResourceRendererProps } from "./types";

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const VideoContentViewer: React.FC<ResourceRendererProps> = ({ item }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused) setShowControls(false);
    }, 2600);
  };

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      return;
    }
    video.pause();
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(time, 0), video.duration || 0);
  };

  const cyclePlaybackRate = () => {
    const video = videoRef.current;
    if (!video) return;
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1;
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const skipBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), video.duration || 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const changeVolume = (nextVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void wrapper.requestFullscreen?.();
  };

  const playedPercentage = duration ? (currentTime / duration) * 100 : 0;
  const controlsAreVisible = showControls || !isPlaying;

  return (
    <div
      ref={wrapperRef}
      role="application"
      aria-label="Video player"
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-content-primary"
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      onMouseMove={showControlsTemporarily}
    >
      <video
        ref={videoRef}
        className="block h-full w-full cursor-pointer bg-content-primary object-contain"
        onClick={togglePlay}
        onEnded={() => {
          setIsPlaying(false);
          setHasEnded(true);
          setShowControls(true);
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onPlay={() => {
          setIsPlaying(true);
          setHasEnded(false);
          showControlsTemporarily();
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        playsInline
        preload="auto"
        src={item.url}
      >
        <track kind="captions" />
      </video>

      {!isPlaying ? (
        <button
          type="button"
          aria-label={hasEnded ? "Replay video" : "Play video"}
          className="absolute left-1/2 top-1/2 inline-flex h-[76px] w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-brand-600 pl-1 text-white shadow-lg transition hover:scale-105 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          onClick={togglePlay}
        >
          <PlayIcon size={32} />
        </button>
      ) : null}

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-content-primary/90 to-transparent px-3.5 pb-3 pt-7 transition duration-200 ${
          controlsAreVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1.5 opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="Seek video"
          className="group relative h-2 w-full cursor-pointer rounded-full border-0 bg-white/25 p-0 transition-all hover:h-2.5"
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - bounds.left) / bounds.width;
            seekTo(ratio * duration);
          }}
        >
          <span
            className="relative block h-full rounded-full bg-brand-600"
            style={{ width: `${playedPercentage}%` }}
          >
            <span className="absolute right-0 top-1/2 h-3.5 w-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100" />
          </span>
        </button>

        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-white">
          <button
            type="button"
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border-0 bg-transparent p-0 text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={togglePlay}
          >
            {isPlaying ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
          </button>
          <button
            type="button"
            aria-label="Rewind 10 seconds"
            className="inline-flex h-[34px] items-center justify-center rounded-lg border-0 bg-transparent px-2 text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={() => skipBy(-10)}
          >
            -10s
          </button>
          <button
            type="button"
            aria-label="Forward 10 seconds"
            className="inline-flex h-[34px] items-center justify-center rounded-lg border-0 bg-transparent px-2 text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={() => skipBy(10)}
          >
            +10s
          </button>
          <div className="group flex items-center">
            <button
              type="button"
              aria-label={isMuted || volume === 0 ? "Unmute video" : "Mute video"}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[11px] font-bold text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? "M" : "Vol"}
            </button>
            <input
              aria-label="Video volume"
              className="ml-0 w-0 cursor-pointer accent-brand-500 opacity-0 transition-all group-hover:ml-1 group-hover:w-[72px] group-hover:opacity-100 focus:ml-1 focus:w-[72px] focus:opacity-100"
              max={1}
              min={0}
              onChange={(event) => changeVolume(Number.parseFloat(event.currentTarget.value))}
              step={0.05}
              type="range"
              value={isMuted ? 0 : volume}
            />
          </div>
          <span className="tabular-nums text-white/90">
            {formatClock(currentTime)} <span className="text-white/50">/</span>{" "}
            {formatClock(duration)}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Change playback speed"
            className="inline-flex h-[34px] items-center justify-center rounded-lg border-0 bg-transparent px-2 text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={cyclePlaybackRate}
          >
            {playbackRate}x
          </button>
          <button
            type="button"
            aria-label="Open video fullscreen"
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border-0 bg-transparent p-0 text-white transition hover:bg-white/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            onClick={toggleFullscreen}
          >
            <ExpandIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

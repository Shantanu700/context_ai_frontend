"use client";

import { useRef, useState } from "react";
import {
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";

import { formatDuration } from "@/lib/videos";

const ICON_BUTTON =
  "shrink-0 rounded-full p-1 transition-colors hover:bg-white/20 focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none";

/** Track fill up to the thumb, one gradient stop — no second element to sync. */
export const filled = (fraction: number, towards: "right" | "top" = "right") => ({
  background: `linear-gradient(to ${towards}, var(--signal) ${
    fraction * 100
  }%, oklch(1 0 0 / 22%) ${fraction * 100}%)`,
});

/** Shared by the editor's threshold and duration sliders — one thumb, defined once. */
export const RANGE =
  "cursor-pointer appearance-none rounded-full outline-none [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm";

/**
 * The native control bar is browser-grey and sits on top of the footage like a
 * sticker. This is the same set of controls in the project's glass material —
 * legal here, since it floats over media rather than over the stage.
 */
export function VideoPlayer({
  src,
  poster,
  ref,
}: {
  src: string;
  poster?: string;
  /** Owned by the parent so scene rows can seek. */
  ref: React.RefObject<HTMLVideoElement | null>;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  const silent = muted || volume === 0;
  const VolumeIcon = silent ? VolumeXIcon : volume < 0.5 ? Volume1Icon : Volume2Icon;

  return (
    <div
      ref={shell}
      className="group well relative aspect-video w-full shrink-0 overflow-hidden rounded-lg"
    >
      <video
        ref={ref}
        src={src}
        playsInline
        poster={poster}
        className="size-full cursor-pointer"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
      />

      {/* The big target, on the frame while it is stopped. */}
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="glass glass-interactive absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        >
          <PlayIcon className="size-6 translate-x-px fill-current" />
        </button>
      )}

      {/* Out of the way while playing; back on hover, keyboard focus, or pause.
          No `glass-interactive` here — its active-state nudge would shift the
          whole bar every time a button inside it is pressed. */}
      <div
        className={`glass absolute inset-x-2 bottom-2 flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-opacity duration-200 ease-glass group-hover:opacity-100 group-focus-within:opacity-100 ${
          playing ? "opacity-0" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={ICON_BUTTON}
        >
          {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          aria-label="Seek"
          onChange={(e) => {
            const el = ref.current;
            if (el) el.currentTime = e.currentTarget.valueAsNumber;
          }}
          style={filled(duration ? time / duration : 0)}
          className={`h-1 min-w-0 flex-1 ${RANGE}`}
        />

        <span data-numeric className="shrink-0 text-[11px] leading-snug">
          {formatDuration(time)} / {formatDuration(duration || null)}
        </span>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setVolumeOpen((open) => !open)}
            aria-label="Volume"
            aria-expanded={volumeOpen}
            className={ICON_BUTTON}
          >
            <VolumeIcon className="size-4" />
          </button>

          {volumeOpen && (
            <div className="glass absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 justify-center rounded-full px-2 py-3">
              {/* Vertical range: writing-mode turns the inline axis, rtl puts
                  zero at the bottom. Standard since Chrome 121 / Safari 17.4. */}
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={silent ? 0 : volume}
                aria-label="Volume level"
                onChange={(e) => {
                  const el = ref.current;
                  if (!el) return;
                  el.volume = e.currentTarget.valueAsNumber;
                  el.muted = el.volume === 0;
                }}
                style={filled(silent ? 0 : volume, "top")}
                className={`h-20 w-1 [direction:rtl] [writing-mode:vertical-lr] ${RANGE}`}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void shell.current?.requestFullscreen().catch(() => {})}
          aria-label="Fullscreen"
          className={ICON_BUTTON}
        >
          <MaximizeIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  LayersIcon,
  MagnetIcon,
  MaximizeIcon,
  MegaphoneIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  Redo2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  ScissorsIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Trash2Icon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";

import { IconAction } from "@/components/editor/icon-action";
import { STATE_STYLE, slotStyle } from "@/components/editor/chrome";
import { useSlotDrag, type DragMode } from "@/components/editor/use-slot-drag";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { assetSrc } from "@/lib/ads";
import { formatTimecode, keyframeTimes, sceneCuts, type Slot } from "@/lib/slots";
import { mediaSrc, type Scene } from "@/lib/api";

/**
 * Lane geometry lives here once — the rails on both sides read the same numbers the
 * tracks do, and `page.tsx`'s player cap is measured against the total. Move a height
 * and that cap moves with it.
 */
const LANES = [
  { id: "scenes", label: "Scenes", icon: FilmIcon, height: 56 },
  { id: "slots", label: "Ad slots", icon: MegaphoneIcon, height: 56 },
  { id: "overlays", label: "Overlays", icon: LayersIcon, height: 48 },
] as const;

const RULER_HEIGHT = 28;
/** Air between tracks, instead of divider rules. Both rails leave the same. */
const LANE_GAP = 8;
const RAIL_WIDTH = 44;
const TAIL_PX = 24;
/** A label every ~90px: the smallest interval that isn't crowded. */
const NICE_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
const MIN_LABEL_GAP_PX = 90;
/** Minor ticks between two labels. */
const TICK_SUBDIVISIONS = 5;
/** Most zoomed-in: this many seconds across the viewport. Past that the lanes are a smear. */
const MIN_WINDOW_SECONDS = 2;
/** Slots can be shorter than a pixel when the whole video is on screen. Keep them grabbable. */
const MIN_BLOCK_PX = 24;
/** The dark seam between two clips. Wide enough to hold the cut mark with air either side. */
const CLIP_GAP = 10;
/** Narrower than this a frame is a smear. Show fewer of them instead. */
const MIN_TILE_PX = 32;
/**
 * Air between a slot's outline and its trim knob. The knob is otherwise the full height of
 * the block, which makes it exactly concentric with the block's own end cap — same centre,
 * radius smaller by this — so the gap reads as an even ring the whole way round the cap.
 * Also what the chevron gets to breathe in: the glyph is a fraction of the knob, below.
 */
const KNOB_INSET = 4;
/** The chevron's share of the knob's diameter. */
const CHEVRON_RATIO = 0.4;
/** React state for the rest of the editor; the playhead itself moves every frame. */
const TIME_STATE_HZ = 30;
/** The nudge buttons either side of the transport. */
const SKIP_SECONDS = 5;
/** Two cuts closer together than this are the same landmark to a person pressing "next". */
const CUT_EPSILON = 0.05;

export function Timeline({
  videoRef,
  duration,
  scenes,
  slots,
  selectedKey,
  onSelect,
  onSeek,
  onTimeUpdate,
  onAddSlot,
  onMoveSlot,
  onTrimSlot,
  onDragStart,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSplit,
  onRemove,
  canSplit,
  canRemove,
  canAddSlot,
  canAddOverlay,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  scenes: Scene[] | null;
  slots: Slot[] | null;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onSeek: (seconds: number) => void;
  onTimeUpdate: (seconds: number) => void;
  onAddSlot: (atSeconds: number, isOverlay?: boolean) => void;
  onMoveSlot: (key: string, atSeconds: number) => void;
  onTrimSlot: (key: string, edge: "start" | "end", time: number) => void;
  onDragStart: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSplit: () => void;
  onRemove: () => void;
  canSplit: boolean;
  canRemove: boolean;
  /** False when the playhead is already inside a slot on that lane — nothing fits there. */
  canAddSlot: boolean;
  canAddOverlay: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ left: 0, width: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [playing, setPlaying] = useState(false);

  /* ---- viewport ----
     Scroll position drives tick culling; width drives fit-to-width. Both are read
     through one rAF-throttled handler so a fast scroll doesn't queue a render per event. */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setView({ left: el.scrollLeft, width: el.clientWidth });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* ---- zoom ----
     Both ends come from the viewport. An absolute px/second ceiling is wrong: a short
     video fits at a hundred-odd px/second, so any fixed cap sits *below* fit and every
     press of zoom-in shrinks the lanes instead of growing them. */
  const fitZoom = view.width > 0 && duration > 0 ? (view.width - TAIL_PX) / duration : 1;
  const maxZoom = Math.max(fitZoom, view.width / MIN_WINDOW_SECONDS);
  const clampZoom = useCallback(
    // Floor last: fit always wins, so the lanes can never be narrower than the lane.
    (value: number) => Math.max(fitZoom, Math.min(maxZoom, value)),
    [fitZoom, maxZoom],
  );

  // Start showing the whole video: the point of this timeline is where the breaks
  // fall across the episode, which you can't see zoomed in. Re-clamped on every render
  // so a stored zoom follows the viewport when the window is resized.
  const effectiveZoom = clampZoom(zoom ?? fitZoom);
  const totalWidth = Math.max(duration * effectiveZoom + TAIL_PX, view.width);

  /** The time under the middle of the viewport, held across a zoom so the view doesn't jump. */
  const anchor = useRef<number | null>(null);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = scroller.current;
      if (el) anchor.current = (el.scrollLeft + el.clientWidth / 2) / effectiveZoom;
      setZoom(clampZoom(effectiveZoom * factor));
    },
    [effectiveZoom, clampZoom],
  );

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || anchor.current == null) return;
    el.scrollLeft = anchor.current * effectiveZoom - el.clientWidth / 2;
    anchor.current = null;
  }, [effectiveZoom]);

  /* ---- playhead ----
     `timeupdate` fires about four times a second, which reads as a stuttering
     playhead. Drive it from rAF instead and write the transform straight to the
     node, so playback costs no React renders; the rest of the editor gets the
     time at 30Hz, which is plenty for a text panel. */
  const lastPush = useRef(0);
  const wasPlaying = useRef(false);
  useEffect(() => {
    let frame = requestAnimationFrame(function tick(now: number) {
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      const node = playhead.current;
      if (!video || !node) return;

      // The loop already holds the element every frame, so the transport reads its
      // state from here rather than binding play/pause listeners that would have to
      // be rebound each time the player remounts.
      if (!video.paused !== wasPlaying.current) {
        wasPlaying.current = !video.paused;
        setPlaying(wasPlaying.current);
      }

      const time = video.currentTime;
      node.style.transform = `translateX(${time * effectiveZoom}px)`;

      if (now - lastPush.current >= 1000 / TIME_STATE_HZ) {
        lastPush.current = now;
        onTimeUpdate(time);
      }

      // Follow the playhead only while playing — doing it during a scrub or a drag
      // would fight the operator for control of the scroll position.
      const el = scroller.current;
      if (el && !video.paused) {
        const x = time * effectiveZoom;
        if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - TAIL_PX) {
          el.scrollLeft = x - el.clientWidth / 2;
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [videoRef, effectiveZoom, onTimeUpdate]);

  /* ---- transport ---- */
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [videoRef]);

  // Through onSeek rather than straight to the element: the page holds the time the
  // inspector and scene card read, and it only hears about a seek that way.
  const nudge = useCallback(
    (by: number) => {
      const video = videoRef.current;
      if (!video) return;
      onSeek(Math.min(Math.max(video.currentTime + by, 0), duration));
    },
    [videoRef, onSeek, duration],
  );

  /* ---- dragging ---- */
  const cuts = useMemo(() => sceneCuts(scenes), [scenes]);

  /** Scene boundaries, sorted and deduped — what prev/next step between. */
  const landmarks = useMemo(() => {
    const sorted = [...cuts].sort((a, b) => a - b);
    return sorted.filter((t, i) => i === 0 || t - sorted[i - 1] > CUT_EPSILON);
  }, [cuts]);

  const toCut = useCallback(
    (direction: -1 | 1) => {
      const video = videoRef.current;
      if (!video) return;
      const now = video.currentTime;
      const target =
        direction === 1
          ? landmarks.find((t) => t > now + CUT_EPSILON)
          : [...landmarks].reverse().find((t) => t < now - CUT_EPSILON);
      // Past the last cut, run to the ends rather than doing nothing.
      onSeek(target ?? (direction === 1 ? duration : 0));
    },
    [videoRef, landmarks, onSeek, duration],
  );

  const { begin, draggingKey, dragMode, snappedTo } = useSlotDrag({
    zoom: effectiveZoom,
    duration,
    snapPoints: cuts,
    snapEnabled,
    onMove: onMoveSlot,
    onTrim: onTrimSlot,
    onStart: onDragStart,
  });

  /* ---- ruler ---- */
  const interval =
    NICE_INTERVALS.find((s) => s * effectiveZoom >= MIN_LABEL_GAP_PX) ??
    NICE_INTERVALS[NICE_INTERVALS.length - 1];

  const ticks = useMemo(() => {
    // Only what's on screen. At full zoom a 40-minute video would otherwise be
    // thousands of tick nodes, nearly all of them scrolled out of sight.
    const from = Math.max(0, (view.left - 120) / effectiveZoom);
    const to = Math.min(duration, (view.left + view.width + 120) / effectiveZoom);
    const step = interval / TICK_SUBDIVISIONS;
    const out: { at: number; label: boolean }[] = [];
    for (let i = Math.floor(from / step); i * step <= to; i++) {
      const at = i * step;
      // Float error accumulates across thousands of steps; snap before comparing.
      out.push({ at, label: Math.abs(at / interval - Math.round(at / interval)) < 1e-6 });
    }
    return out;
  }, [view.left, view.width, effectiveZoom, duration, interval]);

  const timeAt = useCallback(
    (clientX: number) => {
      const el = scroller.current;
      if (!el) return 0;
      const x = clientX - el.getBoundingClientRect().left + el.scrollLeft;
      return Math.min(Math.max(x / effectiveZoom, 0), duration);
    },
    [effectiveZoom, duration],
  );

  const videoSlots = slots?.filter((slot) => !slot.is_overlay) ?? [];
  const overlaySlots = slots?.filter((slot) => slot.is_overlay) ?? [];
  const counts = countBy(slots);

  return (
    // shrink-0: the timeline is a fixed band at the bottom, so its height must not
    // depend on how many controls the toolbar happens to fit on one line.
    <section className="panel flex shrink-0 flex-col overflow-hidden">
      {/* Three clusters on one line. The grid — not `ml-auto` — is what keeps the
          transport centred on the band whatever the sides happen to weigh, and one
          line always: wrapping here silently stole height from the player. */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 overflow-x-auto border-b border-border px-4 py-3">
        {/* editing */}
        <div className="flex items-center gap-1">
          <IconAction label="Undo" keys="⌘Z" onClick={onUndo} disabled={!canUndo}>
            <Undo2Icon />
          </IconAction>
          <IconAction label="Redo" keys="⇧⌘Z" onClick={onRedo} disabled={!canRedo}>
            <Redo2Icon />
          </IconAction>

          <Divider />

          <IconAction
            label={canSplit ? "Split at playhead" : "Put the playhead inside a slot to split it"}
            keys={canSplit ? "S" : undefined}
            onClick={onSplit}
            disabled={!canSplit}
          >
            <ScissorsIcon />
          </IconAction>
          <IconAction
            label={canRemove ? "Delete slot" : "Select a slot to delete it"}
            keys={canRemove ? "⌫" : undefined}
            onClick={onRemove}
            disabled={!canRemove}
            className="text-destructive hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2Icon />
          </IconAction>
          <IconAction
            label={
              canAddSlot
                ? "Add slot at playhead"
                : "The playhead is already inside an ad slot"
            }
            onClick={() => onAddSlot(videoRef.current?.currentTime ?? 0)}
            disabled={!canAddSlot}
          >
            <PlusIcon />
          </IconAction>
        </div>

        {/* transport */}
        <div className="flex items-center justify-center gap-1">
          <IconAction label={`Back ${SKIP_SECONDS}s`} onClick={() => nudge(-SKIP_SECONDS)}>
            <RotateCcwIcon />
          </IconAction>
          <IconAction label="Previous cut" onClick={() => toCut(-1)}>
            <SkipBackIcon />
          </IconAction>
          <IconAction
            label={playing ? "Pause" : "Play"}
            keys="Space"
            variant="signal"
            size="icon-xl"
            className="mx-1"
            onClick={togglePlay}
          >
            {playing ? (
              <PauseIcon className="fill-current" />
            ) : (
              // The triangle's mass sits left of its box; a pixel back centres it.
              <PlayIcon className="translate-x-px fill-current" />
            )}
          </IconAction>
          <IconAction label="Next cut" onClick={() => toCut(1)}>
            <SkipForwardIcon />
          </IconAction>
          <IconAction label={`Forward ${SKIP_SECONDS}s`} onClick={() => nudge(SKIP_SECONDS)}>
            <RotateCwIcon />
          </IconAction>
        </div>

        {/* view */}
        <div className="flex items-center justify-end gap-1">
          {/* The counts and legend are the first things to go when space is tight —
              the controls either side of them are not optional, these are. */}
          <span
            data-numeric
            className="hidden text-[11px] whitespace-nowrap text-muted-foreground xl:inline"
          >
            {counts.total} slots · {counts.accepted} accepted · {counts.held} held
          </span>
          <div className="mr-1 hidden 2xl:block">
            <Legend />
          </div>

          <IconAction
            label={snapEnabled ? "Snapping to cuts" : "Snap to cuts"}
            variant={snapEnabled ? "signal" : "ghost"}
            aria-pressed={snapEnabled}
            onClick={() => setSnapEnabled((on) => !on)}
          >
            <MagnetIcon />
          </IconAction>

          <Divider />

          <IconAction
            label="Zoom out"
            onClick={() => zoomBy(1 / 1.8)}
            disabled={effectiveZoom <= fitZoom}
          >
            <ZoomOutIcon />
          </IconAction>
          <IconAction
            label="Zoom in"
            onClick={() => zoomBy(1.8)}
            disabled={effectiveZoom >= maxZoom}
          >
            <ZoomInIcon />
          </IconAction>
          <IconAction
            label="Fit to width"
            onClick={() => setZoom(null)}
            disabled={effectiveZoom <= fitZoom}
          >
            <MaximizeIcon />
          </IconAction>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 py-2">
        {/* Left rail: what each track is. Held out of the scroll so it stays put. */}
        <Rail>
          {LANES.map((lane) => (
            <Row key={lane.id} height={lane.height}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={lane.label}
                      className="rounded-md p-1.5 text-muted-foreground focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none"
                    />
                  }
                >
                  <lane.icon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="right">{lane.label}</TooltipContent>
              </Tooltip>
            </Row>
          ))}
        </Rail>

        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: totalWidth }}>
            {/* ruler — labels on the nice interval, dotted minor ticks between */}
            <div
              className="sticky top-0 z-10 cursor-pointer border-b border-border/60 bg-panel"
              style={{ height: RULER_HEIGHT }}
              onMouseDown={(e) => onSeek(timeAt(e.clientX))}
            >
              {ticks.map((tick) =>
                tick.label ? (
                  <span
                    key={tick.at}
                    data-numeric
                    // Centred on its tick, except the first — half of 0:00 would hang
                    // off the left edge and get clipped by the scroller.
                    className={`pointer-events-none absolute top-1.5 text-[10px] whitespace-nowrap text-muted-foreground ${
                      tick.at === 0 ? "" : "-translate-x-1/2"
                    }`}
                    style={{ left: tick.at * effectiveZoom }}
                  >
                    {formatTimecode(tick.at)}
                  </span>
                ) : (
                  <span
                    key={tick.at}
                    className="pointer-events-none absolute top-3 size-0.5 rounded-full bg-muted-foreground/40"
                    style={{ left: tick.at * effectiveZoom }}
                  />
                ),
              )}
            </div>

            {/* tracks — air between them, no divider rules */}
            <Lane height={LANES[0].height}>
              {scenes?.slice(1).map((scene) => (
                <span
                  key={`cut-${scene.index}`}
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-white/80"
                  style={{ left: scene.start * effectiveZoom - CLIP_GAP / 2 }}
                />
              ))}
              {scenes?.map((scene) => (
                <SceneBlock
                  key={scene.index}
                  scene={scene}
                  zoom={effectiveZoom}
                  onSeek={onSeek}
                />
              ))}
            </Lane>

            <Lane height={LANES[1].height} onDoubleClick={(e) => onAddSlot(timeAt(e.clientX))}>
              {videoSlots.map((slot) => (
                <SlotBlock
                  key={slot.key}
                  slot={slot}
                  zoom={effectiveZoom}
                  height={LANES[1].height}
                  selected={slot.key === selectedKey}
                  dragMode={slot.key === draggingKey ? dragMode : null}
                  onSelect={() => onSelect(slot.key)}
                  onGrab={begin}
                />
              ))}
            </Lane>

            <Lane
              height={LANES[2].height}
              onDoubleClick={(e) => onAddSlot(timeAt(e.clientX), true)}
            >
              {overlaySlots.map((slot) => (
                <SlotBlock
                  key={slot.key}
                  slot={slot}
                  zoom={effectiveZoom}
                  height={LANES[2].height}
                  selected={slot.key === selectedKey}
                  dragMode={slot.key === draggingKey ? dragMode : null}
                  onSelect={() => onSelect(slot.key)}
                  onGrab={begin}
                />
              ))}
            </Lane>

            {/* snap indicator, only while it is actually holding */}
            {snappedTo != null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-chart-4"
                style={{ left: snappedTo * effectiveZoom }}
              />
            )}

            {/* playhead — transform is written every frame, never through React */}
            <div
              ref={playhead}
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-signal will-change-transform"
            >
              <div className="absolute -top-0.5 -left-1 size-2.5 rotate-45 rounded-[1px] bg-signal" />
            </div>
          </div>
        </div>

        {/* Right rail: add to the tracks the operator owns. Scenes come from analysis. */}
        <Rail>
          <Row height={LANES[0].height} />
          <Row height={LANES[1].height}>
            <IconAction
              label={
                canAddSlot
                  ? "Add ad slot at playhead"
                  : "The playhead is already inside an ad slot"
              }
              size="icon-sm"
              variant="secondary"
              side="left"
              onClick={() => onAddSlot(videoRef.current?.currentTime ?? 0)}
              disabled={!canAddSlot}
            >
              <PlusIcon />
            </IconAction>
          </Row>
          <Row height={LANES[2].height}>
            <IconAction
              label={
                canAddOverlay
                  ? "Add overlay at playhead"
                  : "The playhead is already inside an overlay"
              }
              size="icon-sm"
              variant="secondary"
              side="left"
              onClick={() => onAddSlot(videoRef.current?.currentTime ?? 0, true)}
              disabled={!canAddOverlay}
            >
              <PlusIcon />
            </IconAction>
          </Row>
        </Rail>
      </div>
    </section>
  );
}

/** A fixed column beside the scrolling tracks. Cleared of the ruler so the rows line up. */
function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex shrink-0 flex-col"
      style={{ width: RAIL_WIDTH, paddingTop: RULER_HEIGHT, gap: LANE_GAP }}
    >
      {children}
    </div>
  );
}

/** One rail cell, the exact height of the track it sits beside. */
function Row({ height, children }: { height: number; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      {children}
    </div>
  );
}

/** Groups the icons into readings — undo/redo, then the slot edits — without a label. */
function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function Lane({
  height,
  children,
  onDoubleClick,
}: {
  height: number;
  children: React.ReactNode;
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {
  return (
    // Air below every track, the last one included — it doubles as the band's bottom
    // padding, and the rails leave the same gap so the rows stay level.
    <div
      className="relative"
      style={{ height, marginBottom: LANE_GAP }}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}

/**
 * One scene as a strip of its own keyframes.
 *
 * The frames are equal `flex-1` slices rather than positioned at their true capture
 * times: the backend spaces them evenly inside the scene anyway, and equal slices mean
 * the seam between two frames lands where the eye expects it at any zoom. The gap
 * between scenes is `CLIP_GAP` of bare stage — that, plus the rounded ends either side
 * of it, is what makes one clip ending and the next starting legible.
 */
function SceneBlock({
  scene,
  zoom,
  onSeek,
}: {
  scene: Scene;
  zoom: number;
  onSeek: (seconds: number) => void;
}) {
  const width = Math.max((scene.end - scene.start) * zoom - CLIP_GAP, MIN_BLOCK_PX);
  const times = keyframeTimes(scene);
  // Zoomed out, three frames in 40px is a smear. Drop to as many as will read.
  const shown = Math.max(1, Math.min(times.length, Math.floor(width / MIN_TILE_PX)));

  return (
    <button
      type="button"
      title={scene.description || `Scene ${scene.index + 1}`}
      onClick={() => onSeek(scene.start)}
      // The rim goes on as an overlay below, not as this element's border: the frames
      // are children, so they would paint straight over an inset highlight.
      className="group absolute inset-y-0 overflow-hidden rounded-2xl bg-raised/70 focus-visible:outline-none"
      style={{ left: scene.start * zoom, width }}
    >
      {/* ponytail: lazy <img> instead of windowing the strip — add culling if a video
          ever comes back with hundreds of scenes. */}
      <div className="flex size-full gap-px">
        {times.slice(0, shown).map((at, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
          <img
            key={at}
            src={mediaSrc(scene.keyframe_urls[i]) ?? undefined}
            alt=""
            loading="lazy"
            draggable={false}
            className="min-w-0 flex-1 object-cover"
          />
        ))}
      </div>

      {/* Glass is legal here — it sits on the frames, not on the stage. The rim rather
          than the pane, so the picture underneath stays sharp. */}
      <span
        aria-hidden
        className="glass-rim pointer-events-none absolute inset-0 rounded-2xl transition-colors group-hover:border-white/30 group-focus-visible:border-signal"
      />

      {/* Glass is legal here: it sits on the frame, not on the stage. */}
      <span
        data-numeric
        className="glass absolute bottom-1 left-1 rounded-sm px-1 text-[10px] leading-snug"
      >
        S{String(scene.index + 1).padStart(2, "0")}
      </span>
    </button>
  );
}

function SlotBlock({
  slot,
  zoom,
  height,
  selected,
  dragMode,
  onSelect,
  onGrab,
}: {
  slot: Slot;
  zoom: number;
  /** The lane's height — the knobs are sized off it, so they scale with the track. */
  height: number;
  selected: boolean;
  /** Non-null only while this block is the one being dragged. */
  dragMode: DragMode | null;
  onSelect: () => void;
  onGrab: (event: React.MouseEvent, slot: Slot, mode: DragMode) => void;
}) {
  const style = slotStyle(slot.state, slot.is_overlay);
  const width = Math.max(slot.duration * zoom, MIN_BLOCK_PX);
  const src = slot.ad_detail ? assetSrc(slot.ad_detail) : null;

  // A knob as tall as the block leaves it concentric with the end cap it sits in. That
  // makes them big — 48px on the ad lane — so a slot has to be genuinely wide before both
  // will fit with anything between them left to grab.
  // ponytail: a 15s slot at fit-zoom is well under this and shows no knobs. Trimming to a
  // frame needs zooming in anyway; the block itself still drags at any width.
  const knob = height - KNOB_INSET * 2;
  const trimmable = width >= knob * 2 + MIN_BLOCK_PX;
  // Reserved whether or not the knobs are currently showing: a label that jumped sideways
  // on hover would be worse than one that sits inboard the whole time.
  const gutter = trimmable ? knob + KNOB_INSET * 2 : 12;
  // Below this the second line is a truncated smear; brand alone still reads.
  const roomy = width - gutter * 2 >= 96;

  return (
    // A div, not a button: the trim handles are buttons themselves, and a button may
    // not contain one. Keyboard parity is restored by the Enter/Space handler below.
    <div
      role="button"
      tabIndex={0}
      aria-label={
        slot.ad_detail
          ? `${slot.ad_detail.brand} — ${slot.ad_detail.title}`
          : "Slot with no ad chosen"
      }
      title={
        slot.ad_detail
          ? `${slot.ad_detail.brand} — ${slot.ad_detail.title}`
          : "No ad chosen"
      }
      onMouseDown={(e) => {
        onSelect();
        onGrab(e, slot, "move");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      // A capsule, not a box: the round caps read as one continuous clip the way the
      // scene strip's do, and they seat the trim knobs exactly — a knob the height of the
      // block is inscribed in its own end cap, so `overflow-hidden` never bites it.
      // ponytail: at MIN_BLOCK_PX a 24×56 block turns into a vertical lozenge. Only a
      // sub-pixel slot at full zoom-out gets there, and it carries no readable label anyway.
      className={`group absolute inset-y-0 flex flex-col justify-center gap-0.5 overflow-hidden rounded-full border text-left leading-tight transition-colors focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none ${
        src ? style.edge : style.block
      } ${selected ? "ring-2 ring-signal" : ""} ${
        dragMode === "move" ? "cursor-grabbing" : dragMode ? "cursor-ew-resize" : "cursor-grab"
      }`}
      style={{ left: slot.at_seconds * zoom, width, paddingInline: gutter }}
    >
      {src && (
        <>
          <SlotMedia src={src} isVideo={slot.ad_detail?.ad_type === "video"} />
          {/* Two layers, because they do different jobs: the state wash says what the
              slot is, the gradient buys 11px type enough contrast to survive whatever
              the creative happens to be doing behind it. */}
          <span aria-hidden className={`absolute inset-0 ${style.tint}`} />
          <span
            aria-hidden
            className="absolute inset-0 bg-linear-to-r from-ground/85 to-ground/40"
          />
        </>
      )}

      <span className="relative truncate text-[11px] font-medium">
        {slot.ad_detail?.brand ?? "Unassigned"}
      </span>
      {roomy && (
        <span data-numeric className="relative truncate text-[10px] opacity-70">
          {slot.ad_detail ? `${slot.ad_detail.title} · ` : ""}
          {slot.duration.toFixed(slot.duration % 1 ? 1 : 0)}s
        </span>
      )}
      {/* The score is the model's, so it stays a separate mark rather than body copy. */}
      {slot.score != null && roomy && (
        <span
          data-numeric
          // Inboard of the right knob, same gutter the label respects.
          className="absolute top-0.5 rounded-sm bg-background/40 px-1 text-[10px]"
          style={{ right: gutter }}
        >
          {Math.round(slot.score * 100)}
        </span>
      )}

      {trimmable && (
        <>
          {/* `begin` stops propagation, so the block's own mousedown never runs for
              these — each handle has to select for itself. */}
          <TrimHandle
            edge="start"
            size={knob}
            shown={selected}
            onGrab={(e) => {
              onSelect();
              onGrab(e, slot, "trim-start");
            }}
          />
          <TrimHandle
            edge="end"
            size={knob}
            shown={selected}
            onGrab={(e) => {
              onSelect();
              onGrab(e, slot, "trim-end");
            }}
          />
        </>
      )}
    </div>
  );
}

/** The ad's own creative, behind the label. Ads have no thumbnail endpoint, so a video
 *  ad paints its first frame the way the catalog cards do. */
function SlotMedia({ src, isVideo }: { src: string; isVideo: boolean }) {
  return isVideo ? (
    <video
      src={src}
      preload="metadata"
      muted
      playsInline
      // Nothing here plays: it is the poster frame the metadata load paints.
      className="pointer-events-none absolute inset-0 size-full object-cover"
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className="pointer-events-none absolute inset-0 size-full object-cover"
    />
  );
}

/** The glass knob at a clip's edge — grab it and the duration follows the pointer. */
function TrimHandle({
  edge,
  size,
  shown,
  onGrab,
}: {
  edge: "start" | "end";
  /** Diameter. Square by construction, so it also sets the hit strip's width. */
  size: number;
  /** Selected blocks keep theirs out; the rest reveal on hover. */
  shown: boolean;
  onGrab: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={edge === "start" ? "Trim slot start" : "Trim slot end"}
      onMouseDown={onGrab}
      // Inset from the block's edge on all four sides, so the knob lands concentric with
      // the cap it sits in. The button is the knob's own box — no larger, or the extra
      // would be dead hit area sticking out past the glass.
      style={{
        width: size,
        top: KNOB_INSET,
        bottom: KNOB_INSET,
        [edge === "start" ? "left" : "right"]: KNOB_INSET,
      }}
      className={`absolute z-10 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none ${
        shown ? "opacity-100" : ""
      }`}
    >
      {/* Glass over the stage is against the house rule in globals.css, and an unassigned
          slot is a tint rather than a frame. It stays glass anyway, deliberately: the knob
          is inscribed in a saturated block and refracts the block's own colour — not a pane
          floating on bare ground. Don't "fix" it back to a flat capsule. */}
      <span className="glass glass-interactive flex size-full items-center justify-center rounded-full">
        {edge === "start" ? (
          <ChevronLeftIcon size={Math.round(size * CHEVRON_RATIO)} />
        ) : (
          <ChevronRightIcon size={Math.round(size * CHEVRON_RATIO)} />
        )}
      </span>
    </button>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2">
      {(["accepted", "suggested", "held"] as const).map((state) => (
        <span
          key={state}
          className="flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          <span className={`size-2 rounded-xs ${STATE_STYLE[state].dot}`} />
          {STATE_STYLE[state].label}
        </span>
      ))}
      {/* A different axis from the three beside it, but mint would otherwise be a fourth
          unexplained colour on the lanes. */}
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="size-2 rounded-xs bg-chart-3" />
        Overlay
      </span>
    </div>
  );
}

function countBy(slots: Slot[] | null) {
  return {
    total: slots?.length ?? 0,
    accepted: slots?.filter((s) => s.state === "accepted").length ?? 0,
    held: slots?.filter((s) => s.state === "held").length ?? 0,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type Slot } from "@/lib/slots";

/** Constant in pixels, converted to seconds per zoom level — see `snapTo`. */
const SNAP_PX = 12;

/** Sliding the whole block, or dragging one of its edges. */
export type DragMode = "move" | "trim-start" | "trim-end";

type Args = {
  /** Pixels per second. */
  zoom: number;
  duration: number;
  /** Times worth snapping to — scene cuts, and zero. */
  snapPoints: number[];
  snapEnabled: boolean;
  /** Called on every move with the proposed time; the store applies it. */
  onMove: (key: string, atSeconds: number) => void;
  /** Called on every trim with the time the dragged edge is being pulled to. */
  onTrim: (key: string, edge: "start" | "end", time: number) => void;
  /** Called once at mousedown, before anything changes, so undo has a snapshot. */
  onStart: () => void;
};

/**
 * Dragging a slot along the timeline, and dragging either of its edges.
 *
 * Ported from `../seq`'s `use-timeline-drag.ts`, minus the overlap resolution it needs
 * for clips — ad slots are allowed to sit on top of each other. Two ideas are kept
 * verbatim, because they are what makes dragging feel right:
 *
 * 1. Everything hot lives in a ref, so the window listener has no dependencies and is
 *    bound once per gesture instead of on every render during the drag.
 * 2. The snap threshold is constant in *pixels* and divided by zoom to get seconds, so
 *    snapping feels identical whether the whole video or ten seconds of it is on screen.
 *
 * All three modes are one gesture rather than two hooks: they differ only in which time
 * the pointer is proposing, and the clamping for a trim lives in `trimSlot`.
 */
export function useSlotDrag({
  zoom,
  duration,
  snapPoints,
  snapEnabled,
  onMove,
  onTrim,
  onStart,
}: Args) {
  const [dragging, setDragging] = useState<{ key: string; mode: DragMode } | null>(null);
  const [snappedTo, setSnappedTo] = useState<number | null>(null);

  const state = useRef({ zoom, duration, snapPoints, snapEnabled, onMove, onTrim });
  // seq assigns this during render; React's refs rule forbids that, and after-commit
  // is soon enough — the handler below only reads it once the pointer moves.
  useEffect(() => {
    state.current = { zoom, duration, snapPoints, snapEnabled, onMove, onTrim };
  });

  const gesture = useRef<{
    key: string;
    mode: DragMode;
    startX: number;
    /** The slot as it was at mousedown — a trim measures against the edge that isn't moving. */
    slot: Slot;
  } | null>(null);

  const begin = useCallback(
    (event: React.MouseEvent, slot: Slot, mode: DragMode) => {
      event.preventDefault();
      event.stopPropagation();
      gesture.current = { key: slot.key, mode, startX: event.clientX, slot };
      setDragging({ key: slot.key, mode });
      onStart();
    },
    [onStart],
  );

  useEffect(() => {
    if (dragging === null) return;

    function move(event: MouseEvent) {
      const active = gesture.current;
      if (!active) return;
      const { zoom, duration, snapPoints, snapEnabled, onMove, onTrim } = state.current;
      const { slot, mode } = active;

      const delta = (event.clientX - active.startX) / zoom;
      // Whichever end the pointer is carrying: the start for a move or a left trim,
      // the far edge for a right one. Snapping then applies to that one time.
      const edge =
        mode === "trim-end" ? slot.at_seconds + slot.duration : slot.at_seconds;
      const proposed = clamp(edge + delta, 0, duration);
      const snapped = snapEnabled ? snapTo(proposed, snapPoints, SNAP_PX / zoom) : null;
      const at = snapped ?? proposed;

      // The hook turns a pointer into a time and stops there. What that time means for
      // the slot — the neighbours it may not cross, the length bounds — is the model's
      // business, and lives in lib/slots.
      setSnappedTo(snapped);
      if (mode === "move") onMove(active.key, at);
      else onTrim(active.key, mode === "trim-start" ? "start" : "end", at);
    }

    function end() {
      gesture.current = null;
      setDragging(null);
      setSnappedTo(null);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
    };
  }, [dragging]);

  return { begin, draggingKey: dragging?.key ?? null, dragMode: dragging?.mode ?? null, snappedTo };
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/** Nearest snap point within `threshold` seconds, or null to leave the value alone. */
function snapTo(
  time: number,
  points: number[],
  threshold: number,
): number | null {
  let best: number | null = null;
  let bestDistance = threshold;
  for (const point of points) {
    const distance = Math.abs(point - time);
    if (distance <= bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

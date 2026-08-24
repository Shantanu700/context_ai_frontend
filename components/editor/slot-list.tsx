"use client";

import { useState } from "react";
import { CheckIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconAction } from "@/components/editor/icon-action";
import { Skeleton } from "@/components/ui/skeleton";
import { RANGE, filled } from "@/components/video-player";
import { CHIP, EYEBROW, PLACEMENT_LABEL, slotStyle } from "@/components/editor/chrome";
import { formatTimecode, sceneAt, type Slot } from "@/lib/slots";
import type { Scene } from "@/lib/api";

export function SlotList({
  slots,
  scenes,
  selectedKey,
  onSelect,
  onRemove,
  onAcceptAbove,
}: {
  slots: Slot[] | null;
  scenes: Scene[] | null;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
  onAcceptAbove: (threshold: number) => void;
}) {
  const [threshold, setThreshold] = useState(0.85);

  if (slots === null) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const pending = slots.filter((slot) => slot.state === "suggested");
  const qualifying = pending.filter((slot) => (slot.score ?? 0) >= threshold);
  const scored = pending.map((slot) => slot.score).filter((s) => s != null);
  const bestScore = scored.length > 0 ? Math.max(...scored) : null;

  return (
    <>
      <div className="flex shrink-0 items-baseline gap-2">
        <h2 className={EYEBROW}>Ad slots</h2>
        <span data-numeric className="text-[11px] text-muted-foreground">
          {slots.length}
        </span>
      </div>

      {/* Bulk accept. Only ever promotes suggestions — it can't overturn a decision
          the operator already made, in either direction. */}
      <div className="well flex shrink-0 flex-col gap-2 p-2.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="threshold" className="text-xs font-medium">
            Bulk accept above
          </label>
          <span data-numeric className="text-xs text-signal">
            {Math.round(threshold * 100)}%
          </span>
        </div>
        <input
          id="threshold"
          type="range"
          min={0.5}
          max={1}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(e.currentTarget.valueAsNumber)}
          style={filled((threshold - 0.5) / 0.5)}
          className={`h-1 w-full ${RANGE}`}
        />
        <div className="flex items-center justify-between gap-2">
          {/* When nothing qualifies, say where the bar would have to be — otherwise
              "0 slots qualify" gives no hint that the slider is the thing to move. */}
          <span className="text-[11px] text-muted-foreground">
            {qualifying.length > 0
              ? `${qualifying.length} slot${qualifying.length === 1 ? "" : "s"} qualify`
              : bestScore != null
                ? `None yet · best is ${Math.round(bestScore * 100)}%`
                : "No scored suggestions"}
          </span>
          <Button
            variant="signal"
            size="xs"
            disabled={qualifying.length === 0}
            onClick={() => onAcceptAbove(threshold)}
          >
            Accept all
          </Button>
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          No slots yet. Add one from the timeline, or re-run analysis so the model can
          suggest placements.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
          {slots.map((slot) => (
            // The delete control is a sibling of the row, not a child: the row is
            // itself a button, and a button inside a button is not a thing.
            <li key={slot.key} className="group relative">
              <Row
                slot={slot}
                scene={sceneAt(scenes, slot.at_seconds)}
                selected={slot.key === selectedKey}
                onSelect={() => onSelect(slot.key)}
              />
              <IconAction
                label="Delete slot"
                side="left"
                size="icon-xs"
                onClick={() => onRemove(slot.key)}
                className="absolute top-2 right-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100"
              >
                <Trash2Icon />
              </IconAction>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Row({
  slot,
  scene,
  selected,
  onSelect,
}: {
  slot: Slot;
  scene: Scene | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = slotStyle(slot.state, slot.is_overlay);
  const score = slot.score;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`flex w-full flex-col gap-1.5 rounded-lg p-2.5 text-left transition-colors focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none ${
        selected ? "bg-raised ring-1 ring-signal" : "hover:bg-raised/60"
      }`}
    >
      {/* pr-7 always, not on hover: the delete control sits over this line, and the
          score must not shuffle sideways when it appears. */}
      <div className="flex items-center gap-1.5 pr-7">
        <span data-numeric className="text-[11px] text-muted-foreground">
          {formatTimecode(slot.at_seconds)}
        </span>
        <span className={CHIP}>{PLACEMENT_LABEL[slot.placement]}</span>
        {score != null && (
          // A weak match shouldn't wear the commit colour just for being a number.
          <span
            data-numeric
            className={`ml-auto text-[11px] ${
              score >= 0.7 ? "text-signal" : "text-muted-foreground"
            }`}
          >
            {Math.round(score * 100)}%
          </span>
        )}
      </div>

      {slot.ad_detail ? (
        // Brand as the eyebrow, title as the line that matters — the column is too
        // narrow for "Brand — Title" to survive truncation.
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] text-muted-foreground">
            {slot.ad_detail.brand}
          </span>
          <span className="line-clamp-2 text-[13px] leading-snug font-medium">
            {slot.ad_detail.title}
          </span>
        </div>
      ) : (
        <span className="text-[13px] text-muted-foreground">No ad chosen</span>
      )}

      {scene?.rationale && (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {scene.rationale}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <span
          className={`flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug ${style.chip}`}
        >
          {slot.state === "accepted" && <CheckIcon className="size-3" />}
          {style.label}
        </span>
        {slot.is_overlay && <span className={CHIP}>Overlay</span>}
        {scene?.brand_safety_flag && (
          // Icon only: spelling it out wraps the row onto a fourth line.
          <ShieldAlertIcon
            aria-label="Brand safety flagged"
            className="size-3.5 shrink-0 text-destructive"
          />
        )}
      </div>
    </button>
  );
}

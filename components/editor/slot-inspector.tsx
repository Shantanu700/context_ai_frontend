"use client";

import { useState } from "react";
import { CheckIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RANGE, filled } from "@/components/video-player";
import { CHIP, EYEBROW, PLACEMENT_LABEL, slotStyle } from "@/components/editor/chrome";
import {
  DURATION_PRESETS,
  MAX_SLOT_DURATION,
  formatTimecode,
  type Slot,
} from "@/lib/slots";
import { assetSrc } from "@/lib/ads";
import type { Ad, PlacementEnum } from "@/lib/api";

export function SlotInspector({
  slot,
  ads,
  onUpdate,
  onRemove,
}: {
  slot: Slot | null;
  ads: Ad[] | null;
  onUpdate: (patch: Partial<Slot>) => void;
  onRemove: () => void;
}) {
  if (!slot) {
    return (
      <>
        <h2 className={EYEBROW}>Slot inspector</h2>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm">Nothing selected</p>
          <p className="text-xs text-muted-foreground">
            Pick a slot from the list or the timeline to decide what runs there.
          </p>
        </div>
      </>
    );
  }

  return <Inspector key={slot.key} slot={slot} ads={ads} onUpdate={onUpdate} onRemove={onRemove} />;
}

function Inspector({
  slot,
  ads,
  onUpdate,
  onRemove,
}: {
  slot: Slot;
  ads: Ad[] | null;
  onUpdate: (patch: Partial<Slot>) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const style = slotStyle(slot.state, slot.is_overlay);

  return (
    <>
      <div className="flex items-baseline gap-2">
        <h2 className={EYEBROW}>Slot inspector</h2>
        <span data-numeric className="ml-auto text-[11px] text-muted-foreground">
          {formatTimecode(slot.at_seconds)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {/* Accept / reject. The two are a toggle, not a commit — clicking the
            active one puts the slot back to undecided. */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={slot.state === "accepted" ? "signal" : "secondary"}
            size="sm"
            onClick={() =>
              onUpdate({ state: slot.state === "accepted" ? "suggested" : "accepted" })
            }
          >
            <CheckIcon />
            Accept
          </Button>
          <Button
            variant={slot.state === "rejected" ? "destructive" : "secondary"}
            size="sm"
            onClick={() =>
              onUpdate({ state: slot.state === "rejected" ? "suggested" : "rejected" })
            }
          >
            <XIcon />
            Reject
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[11px] leading-snug ${style.chip}`}
          >
            {style.label}
          </span>
          <Button
            variant={slot.state === "held" ? "secondary" : "ghost"}
            size="xs"
            className="ml-auto"
            onClick={() =>
              onUpdate({ state: slot.state === "held" ? "suggested" : "held" })
            }
          >
            {slot.state === "held" ? "Release" : "Hold for review"}
          </Button>
        </div>

        <Section label="Creative">
          {slot.ad_detail ? (
            <AdRow ad={slot.ad_detail} score={slot.score} current />
          ) : (
            <p className="text-xs text-muted-foreground">
              No ad on this slot yet — pick one below.
            </p>
          )}

          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search the ad library"
              aria-label="Search the ad library"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <AdPicker
            ads={ads}
            query={query}
            currentId={slot.ad}
            onPick={(ad) =>
              onUpdate({
                ad: ad.id,
                ad_detail: ad,
                // the score belonged to the model's pick; a hand-chosen ad has none
                score: ad.id === slot.ad ? slot.score : null,
                is_overlay: ad.ad_type === "overlay",
              })
            }
          />
        </Section>

        <Section label="Placement">
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(PLACEMENT_LABEL) as PlacementEnum[]).map((placement) => (
              <Button
                key={placement}
                variant={slot.placement === placement ? "signal" : "secondary"}
                size="xs"
                onClick={() => onUpdate({ placement })}
              >
                {PLACEMENT_LABEL[placement]}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant={slot.is_overlay ? "secondary" : "signal"}
              size="xs"
              onClick={() => onUpdate({ is_overlay: false })}
            >
              Video break
            </Button>
            <Button
              variant={slot.is_overlay ? "signal" : "secondary"}
              size="xs"
              onClick={() => onUpdate({ is_overlay: true })}
            >
              Overlay
            </Button>
          </div>
        </Section>

        <Section label="Duration">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Seconds on screen</span>
            <span data-numeric className="text-xs text-signal">
              {slot.duration.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_SLOT_DURATION}
            step={0.5}
            value={slot.duration}
            aria-label="Slot duration in seconds"
            onChange={(e) => onUpdate({ duration: e.currentTarget.valueAsNumber })}
            style={filled((slot.duration - 1) / (MAX_SLOT_DURATION - 1))}
            className={`h-1 w-full ${RANGE}`}
          />
          <div className="grid grid-cols-3 gap-1.5">
            {DURATION_PRESETS.map((seconds) => (
              <Button
                key={seconds}
                variant={slot.duration === seconds ? "signal" : "secondary"}
                size="xs"
                onClick={() => onUpdate({ duration: seconds })}
              >
                {seconds}s
              </Button>
            ))}
          </div>
        </Section>

        <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
          <Trash2Icon />
          Remove this slot
        </Button>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={EYEBROW}>{label}</h3>
      {children}
    </div>
  );
}

function AdPicker({
  ads,
  query,
  currentId,
  onPick,
}: {
  ads: Ad[] | null;
  query: string;
  currentId: number | null;
  onPick: (ad: Ad) => void;
}) {
  if (ads === null) {
    return <p className="text-xs text-muted-foreground">Loading the ad library…</p>;
  }

  const needle = query.trim().toLowerCase();
  const matches = ads.filter(
    (ad) =>
      ad.id !== currentId &&
      (needle === "" ||
        `${ad.brand} ${ad.title}`.toLowerCase().includes(needle)),
  );

  if (matches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {ads.length === 0 ? "The ad library is empty." : "No ads match that."}
      </p>
    );
  }

  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {matches.map((ad) => (
        <li key={ad.id}>
          <button
            type="button"
            onClick={() => onPick(ad)}
            className="w-full rounded-lg p-1.5 text-left transition-colors hover:bg-raised/60 focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none"
          >
            <AdRow ad={ad} score={null} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AdRow({
  ad,
  score,
  current = false,
}: {
  ad: Ad;
  score: number | null;
  current?: boolean;
}) {
  const src = assetSrc(ad);
  return (
    <div
      className={`flex items-center gap-2.5 ${
        current ? "well rounded-lg p-2" : ""
      }`}
    >
      <div className="well relative size-9 shrink-0 overflow-hidden rounded-md">
        {src && ad.ad_type === "overlay" ? (
          // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
          <img src={src} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center text-[10px] text-muted-foreground uppercase">
            {ad.ad_type === "overlay" ? "OVL" : "VID"}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{ad.title}</span>
        <span className="truncate text-[11px] text-muted-foreground">{ad.brand}</span>
      </div>

      {score != null ? (
        <span data-numeric className="shrink-0 text-[11px] text-signal">
          {score.toFixed(2)}
        </span>
      ) : (
        current && <span className={CHIP}>current</span>
      )}
    </div>
  );
}

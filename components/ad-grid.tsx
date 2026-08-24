"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState } from "react";
import {
  ImageIcon,
  LayersIcon,
  Loader2,
  PlayIcon,
  ReplaceIcon,
  TrashIcon,
  VideoIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ad } from "@/lib/api";
import { assetSrc, categoriesOf } from "@/lib/ads";
import { formatDuration } from "@/lib/videos";

const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

/**
 * The catalog, as a contact sheet: the creative is the card, the metadata sits
 * under it. Cards are presentational — the list, its polling and deletion live
 * in `useAds`, and the asset upload is owned by the page so its errors land in
 * the same place as the create form's.
 */
export function AdGrid({
  ads,
  replacing,
  filtered,
  onRemove,
  onReplaceAsset,
}: {
  ads: Ad[] | null;
  replacing: number | null;
  /** True when a filter or search is narrowing the list — changes the empty copy. */
  filtered?: boolean;
  onRemove: (id: number) => void;
  onReplaceAsset: (id: number, file: File) => void;
}) {
  if (ads === null) {
    return (
      <ul className={GRID} aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="well flex flex-col overflow-hidden rounded-xl">
            <Skeleton className="aspect-video rounded-none" />
            <div className="flex flex-col gap-2 p-3">
              <Skeleton className="h-2 w-24 rounded-full" />
              <Skeleton className="h-3.5 w-40 rounded-full" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center">
        <p className="text-sm">
          {filtered ? "Nothing matches" : "No creatives yet"}
        </p>
        <p className="text-xs text-muted-foreground">
          {filtered
            ? "Clear the search or pick a different filter."
            : "Add one on the left and it becomes matchable once it embeds."}
        </p>
      </div>
    );
  }

  return (
    <ul className={GRID}>
      {ads.map((ad) => (
        <AdCard
          key={ad.id}
          ad={ad}
          replacing={replacing === ad.id}
          onRemove={onRemove}
          onReplaceAsset={onReplaceAsset}
        />
      ))}
    </ul>
  );
}

function AdCard({
  ad,
  replacing,
  onRemove,
  onReplaceAsset,
}: {
  ad: Ad;
  replacing: boolean;
  onRemove: (id: number) => void;
  onReplaceAsset: (id: number, file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const src = assetSrc(ad);
  const label = `${ad.brand} — ${ad.title}`;
  const isVideo = ad.ad_type === "video";
  // Glass is only legal over media. With no creative these float on a plain well.
  const overlayVariant = src ? "glass" : "ghost";

  const categories = categoriesOf(ad);
  const visible = categories.slice(0, 2);
  const hidden = categories.slice(2);

  // Hovering a card previews the ad — the whole point of a contact sheet. Muted
  // and reset on leave, and skipped entirely for anyone who asked for less motion.
  function preview(play: boolean) {
    const element = video.current;
    if (!element) return;
    if (play) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      void element.play().catch(() => {});
      return;
    }
    element.pause();
    element.currentTime = 0;
  }

  return (
    // An outline, not a ring: `well` owns box-shadow for its inset shadow, and
    // a Tailwind ring would fight it for the same property.
    <li
      onMouseEnter={() => preview(true)}
      onMouseLeave={() => preview(false)}
      className="group well flex flex-col overflow-hidden rounded-xl outline-1 outline-transparent transition-[outline-color] hover:outline-white/15 has-focus-visible:outline-signal"
    >
      <div className="relative aspect-video shrink-0 overflow-hidden bg-ground">
        {src ? (
          isVideo ? (
            // preload="metadata" paints the first frame and hands us the
            // duration; there is no thumbnail endpoint for ads the way there is
            // for videos.
            <video
              ref={video}
              src={src}
              preload="metadata"
              muted
              loop
              playsInline
              onLoadedMetadata={(event) =>
                setDuration(event.currentTarget.duration)
              }
              className="size-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
            <img
              src={src}
              alt=""
              loading="lazy"
              className="size-full object-contain"
            />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-[repeating-linear-gradient(135deg,transparent_0_7px,oklch(1_0_0/3%)_7px_14px)] text-muted-foreground">
            <ImageIcon className="size-5 opacity-60" />
            <p className="text-xs">No creative yet</p>
          </div>
        )}

        {/* The affordance for hover-to-play. It gets out of the way once the
            preview is running. */}
        {src && isVideo && (
          <span
            aria-hidden
            className="glass pointer-events-none absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full opacity-80 transition-opacity duration-200 group-hover:opacity-0"
          >
            <PlayIcon className="size-3.5 fill-current" />
          </span>
        )}

        {/* Glass is legal here: it sits on the creative, not on the stage. */}
        <span
          className={`absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-snug ${
            src ? "glass" : "bg-raised/80 text-muted-foreground"
          }`}
        >
          {isVideo ? (
            <VideoIcon className="size-3" />
          ) : (
            <LayersIcon className="size-3" />
          )}
          {ad.ad_type}
        </span>

        {src && isVideo && duration != null && (
          <span
            data-numeric
            className="glass absolute right-1.5 bottom-1.5 rounded-md px-1.5 py-0.5 text-[11px] leading-snug"
          >
            {formatDuration(duration)}
          </span>
        )}

        {/* Two buttons per card times a full grid is a lot of chrome. They come
            out on hover, and on focus so the keyboard still reaches them.
            Touch has no hover, so below md they stay put. */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
          <Button
            size="icon-sm"
            variant={overlayVariant}
            aria-label={`Replace the creative for ${label}`}
            disabled={replacing}
            onClick={() => fileInput.current?.click()}
          >
            {replacing ? <Loader2 className="animate-spin" /> : <ReplaceIcon />}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*,image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onReplaceAsset(ad.id, file);
              event.target.value = "";
            }}
          />

          <AlertDialog.Root>
            <AlertDialog.Trigger
              render={
                <Button
                  size="icon-sm"
                  variant={overlayVariant}
                  aria-label={`Delete ${label}`}
                  className="hover:text-destructive"
                />
              }
            >
              <TrashIcon />
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
              <AlertDialog.Popup className="panel fixed top-1/2 left-1/2 z-50 flex w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 p-4 shadow-glass transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                <div className="flex flex-col gap-1">
                  <AlertDialog.Title className="text-base font-semibold">
                    Delete this creative?
                  </AlertDialog.Title>
                  <AlertDialog.Description className="text-sm text-muted-foreground">
                    {label} leaves the catalog and stops being matched to scenes.
                    This can&apos;t be undone.
                  </AlertDialog.Description>
                </div>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Close render={<Button size="sm" variant="ghost" />}>
                    Cancel
                  </AlertDialog.Close>
                  <AlertDialog.Close
                    render={<Button size="sm" variant="destructive" />}
                    onClick={() => onRemove(ad.id)}
                  >
                    Delete
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {ad.brand}
          </p>
          <p className="text-[15px] leading-6 font-semibold">{ad.title}</p>
        </div>

        {/* The description is what the ad actually is — the richest thing on the
            card, so it gets read like copy rather than hidden behind metadata. */}
        <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
          {ad.description}
        </p>

        {categories.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {visible.map((category) => (
              <li
                key={category}
                className="rounded-full bg-raised/70 px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-white/5"
              >
                {category}
              </li>
            ))}
            {hidden.length > 0 && (
              <li
                title={hidden.join(", ")}
                data-numeric
                className="rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground/70"
              >
                +{hidden.length}
              </li>
            )}
          </ul>
        )}

        <div
          data-numeric
          className="mt-auto flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-[11px] text-muted-foreground"
        >
          <span className="truncate">
            <span className="opacity-50">tone</span>{" "}
            {ad.target_tone || <span className="opacity-50">unset</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                ad.is_embedded ? "bg-muted-foreground/50" : "animate-pulse bg-signal"
              }`}
            />
            {ad.is_embedded ? "embedded" : "embedding"}
          </span>
        </div>
      </div>
    </li>
  );
}

"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { CheckIcon, TrashIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VideoList } from "@/lib/api";
import {
  describeStatus,
  formatDuration,
  labelFor,
  thumbnailSrc,
} from "@/lib/videos";

/**
 * The queue. Rows are presentational — the list, its polling and deletion all
 * live in `useVideos`, because the preview panel reads the same rows.
 */
export function VideoQueue({
  videos,
  selected,
  onSelect,
  onRemove,
}: {
  videos: VideoList[] | null;
  selected: string | null;
  onSelect: (uuid: string) => void;
  onRemove: (uuid: string) => void;
}) {
  if (videos === null) {
    return <p className="text-sm text-muted-foreground">Loading your videos…</p>;
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm">No videos yet</p>
        <p className="text-xs text-muted-foreground">
          Add one on the left and it will start processing here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {videos.map((video) => {
        const { label, percent } = describeStatus(video);
        const failed = video.status === "failed";
        const done = video.status === "done";
        const name = labelFor(video.uuid);
        const thumb = thumbnailSrc(video);

        const isSelected = video.uuid === selected;

        return (
          <li
            key={video.uuid}
            className={`relative flex items-center gap-3.5 rounded-lg p-2 transition-colors has-[button:focus-visible]:ring-1 has-[button:focus-visible]:ring-signal ${
              isSelected ? "bg-raised" : "hover:bg-raised/60"
            }`}
          >
            {/* Stretched over the row so the whole thing is one click target,
                without nesting the delete button inside another button. */}
            <button
              type="button"
              onClick={() => onSelect(video.uuid)}
              aria-current={isSelected}
              className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none"
            >
              <span className="sr-only">Preview {name}</span>
            </button>

            <div className="well relative aspect-video w-32 shrink-0 overflow-hidden rounded-md">
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
                <img
                  src={thumb}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              )}
              {/* Glass is legal here: it sits on the frame, not on the stage. */}
              {thumb && video.duration != null && (
                <span
                  data-numeric
                  className="glass absolute right-1.5 bottom-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug"
                >
                  {formatDuration(video.duration)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold">
                  {name}
                </p>

                <AlertDialog.Root>
                  <AlertDialog.Trigger
                    render={
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${name}`}
                        className="relative z-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                          Delete this video?
                        </AlertDialog.Title>
                        <AlertDialog.Description className="text-sm text-muted-foreground">
                          {name} and everything analyzed from it go away. This
                          can&apos;t be undone.
                        </AlertDialog.Description>
                      </div>
                      <div className="flex justify-end gap-2">
                        <AlertDialog.Close
                          render={<Button size="sm" variant="ghost" />}
                        >
                          Cancel
                        </AlertDialog.Close>
                        <AlertDialog.Close
                          render={<Button size="sm" variant="destructive" />}
                          onClick={() => onRemove(video.uuid)}
                        >
                          Delete
                        </AlertDialog.Close>
                      </div>
                    </AlertDialog.Popup>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </div>

              <p
                className={`line-clamp-2 text-sm ${
                  failed ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {done && (
                  <CheckIcon className="mr-1 inline size-3.5 align-[-0.15em] text-signal" />
                )}
                {failed && (
                  <TriangleAlertIcon className="mr-1 inline size-3.5 align-[-0.15em]" />
                )}
                {label}
              </p>

              {!failed && !done ? (
                // A progress track is a well — the design system assigns that
                // surface to inputs, tracks and scrub areas.
                <div className="well mt-2 h-1 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full bg-signal ${
                      percent === null
                        ? "w-1/3 animate-pulse"
                        : "transition-[width]"
                    }`}
                    style={
                      percent === null ? undefined : { width: `${percent}%` }
                    }
                  />
                </div>
              ) : (
                video.width != null && (
                  <p
                    data-numeric
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {video.width}×{video.height}
                  </p>
                )
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

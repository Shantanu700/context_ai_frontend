"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CloudOffIcon,
  DownloadIcon,
  Loader2,
  TriangleAlertIcon,
} from "lucide-react";

import { IconAction } from "@/components/editor/icon-action";
import { SceneCard } from "@/components/editor/scene-card";
import { SlotInspector } from "@/components/editor/slot-inspector";
import { SlotList } from "@/components/editor/slot-list";
import { Timeline } from "@/components/editor/timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/components/video-player";
import { useAds } from "@/hooks/use-ads";
import { useEditor } from "@/hooks/use-editor";
import {
  canAddAt,
  canSplitAt,
  downloadManifest,
  formatTimecode,
  placeSlot,
  placementFor,
  sceneAt,
  trimSlot,
  type Slot,
} from "@/lib/slots";
import { labelFor, thumbnailSrc, videoSrc } from "@/lib/videos";

export default function EditorPage({ params }: PageProps<"/editor/[uuid]">) {
  const { uuid } = use(params);
  const editor = useEditor(uuid);
  const { ads } = useAds();
  const player = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);

  const { video, scenes, slots, selected, update } = editor;

  const seek = useCallback((seconds: number) => {
    const el = player.current;
    if (!el) return;
    el.currentTime = seconds;
    setTime(seconds);
  }, []);

  /* ---- keyboard ----
     The page re-renders at 30Hz while the video plays, so a listener that closed over
     the editor would rebind every frame. Keep the moving parts in a ref, bind once. */
  const live = useRef({ editor, selected, time });
  useEffect(() => {
    live.current = { editor, selected, time };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The inspector has an ad search field and two sliders; they keep their own keys.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const { editor, selected, time } = live.current;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (meta || event.altKey) return;

      switch (event.key) {
        case " ": {
          const el = player.current;
          if (!el) return;
          event.preventDefault(); // otherwise the shell scrolls under the player
          if (el.paused) void el.play().catch(() => {});
          else el.pause();
          return;
        }
        case "Delete":
        case "Backspace": {
          if (!selected) return;
          event.preventDefault();
          editor.remove(selected.key);
          return;
        }
        case "s":
        case "S": {
          if (!selected || !canSplitAt(selected, time)) return;
          event.preventDefault();
          editor.split(selected.key, time);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * The one way a slot's position ever changes. `placeSlot` and `trimSlot` have already
   * fitted it between its neighbours, so all this adds is the relabel: a slot dragged
   * past the 5% marks is a pre- or post-roll now, the same way seeding decided.
   */
  const settle = useCallback(
    (key: string, next: Pick<Slot, "at_seconds" | "duration">) =>
      update(
        key,
        { ...next, placement: placementFor(next.at_seconds, video?.duration) },
        false, // the whole drag is one undo entry, taken at mousedown
      ),
    [update, video?.duration],
  );

  const moveSlot = useCallback(
    (key: string, atSeconds: number) => {
      const slot = slots?.find((s) => s.key === key);
      if (!slot) return;
      settle(key, placeSlot(slots ?? [], slot, atSeconds, video?.duration ?? 0));
    },
    [slots, settle, video?.duration],
  );

  const resizeSlot = useCallback(
    (key: string, edge: "start" | "end", time: number) => {
      const slot = slots?.find((s) => s.key === key);
      if (!slot) return;
      settle(key, trimSlot(slots ?? [], slot, edge, time, video?.duration ?? 0));
    },
    [slots, settle, video?.duration],
  );

  if (editor.loadError) {
    return (
      <section className="panel flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <TriangleAlertIcon className="size-5 text-destructive" />
        <p className="max-w-sm text-sm leading-relaxed">{editor.loadError}</p>
        <Button render={<Link href="/projects" />} variant="secondary" size="sm">
          Back to projects
        </Button>
      </section>
    );
  }

  const src = video ? videoSrc(video) : null;
  const duration = video?.duration ?? 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* title bar */}
      <header className="panel flex shrink-0 flex-wrap items-center gap-3 px-3 py-2">
        <IconAction
          render={<Link href="/projects" />}
          size="icon-sm"
          side="bottom"
          label="Back to projects"
        >
          <ArrowLeftIcon />
        </IconAction>

        {video ? (
          <>
            <span className="truncate text-sm font-medium">{labelFor(video.uuid)}</span>
            <span data-numeric className="text-[11px] text-muted-foreground">
              {formatTimecode(duration)} · {scenes?.length ?? 0} scenes
            </span>
          </>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}

        <div className="ml-auto flex items-center gap-3">
          <SaveBadge state={editor.saveState} error={editor.saveError} />
          <Button
            variant="signal"
            size="sm"
            disabled={!video || !slots?.some((s) => s.state === "accepted")}
            onClick={() => video && slots && downloadManifest(video, slots)}
          >
            <DownloadIcon />
            Export plan
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 gap-2 overflow-y-auto lg:grid-cols-[17rem_minmax(0,1fr)_18rem] lg:overflow-hidden xl:grid-cols-[19rem_minmax(0,1fr)_19rem]">
        <section className="panel flex min-h-0 flex-col gap-3 overflow-hidden p-3 max-lg:h-80">
          <SlotList
            slots={slots}
            scenes={scenes}
            selectedKey={editor.selectedKey}
            onSelect={editor.select}
            onRemove={editor.remove}
            onAcceptAbove={editor.acceptAbove}
          />
        </section>

        <section className="panel flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-3">
          {/* Cap by height as well as width: at a 16:9 ratio a wide column would
              otherwise make the player taller than the space it sits in. ~27.5rem is
              the shell chrome above and below (header, title bar, timeline, gaps) —
              measured, so it moves when the timeline band's lanes do. */}
          <div className="relative w-full max-w-[min(100%,calc((100svh-27.5rem)*16/9))]">
            {src ? (
              <>
                <VideoPlayer
                  ref={player}
                  src={src}
                  poster={video ? (thumbnailSrc(video) ?? undefined) : undefined}
                />
                <SceneCard scene={sceneAt(scenes, time)} />
              </>
            ) : (
              <div className="well grid aspect-video w-full place-items-center rounded-lg">
                {editor.loading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No playable file for this video.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="panel flex min-h-0 flex-col gap-3 overflow-hidden p-3 max-lg:h-96">
          <SlotInspector
            slot={selected}
            ads={ads}
            onUpdate={(patch) => {
              if (!selected) return;
              // The slider lengthens a slot as surely as a trim handle does, so it
              // stops at the neighbour the same way. Everything else passes straight through.
              if (patch.duration == null) return update(selected.key, patch);
              const end = selected.at_seconds + patch.duration;
              update(selected.key, {
                ...patch,
                ...trimSlot(slots ?? [], selected, "end", end, video?.duration ?? 0),
              });
            }}
            onRemove={() => selected && editor.remove(selected.key)}
          />
        </section>
      </div>

      {/* timeline */}
      <Timeline
        videoRef={player}
        duration={duration}
        scenes={scenes}
        slots={slots}
        selectedKey={editor.selectedKey}
        onSelect={editor.select}
        onSeek={seek}
        onTimeUpdate={setTime}
        onAddSlot={(atSeconds, isOverlay) =>
          editor.add(atSeconds, isOverlay ? { is_overlay: true } : undefined)
        }
        onMoveSlot={moveSlot}
        onTrimSlot={resizeSlot}
        onDragStart={editor.snapshot}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onSplit={() => selected && editor.split(selected.key, time)}
        onRemove={() => selected && editor.remove(selected.key)}
        canSplit={canSplitAt(selected, time)}
        canRemove={!!selected}
        // Booleans rather than the time itself: the timeline writes its playhead
        // straight to the DOM to stay out of React, and a 30Hz prop would undo that.
        canAddSlot={canAddAt(slots ?? [], time, false, duration)}
        canAddOverlay={canAddAt(slots ?? [], time, true, duration)}
      />
    </div>
  );
}

function SaveBadge({
  state,
  error,
}: {
  state: "idle" | "saving" | "error";
  error: string | null;
}) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        role="alert"
        title={error ?? undefined}
        className="flex items-center gap-1.5 text-[11px] text-destructive"
      >
        <CloudOffIcon className="size-3" />
        Not saved
      </span>
    );
  }
  return null;
}

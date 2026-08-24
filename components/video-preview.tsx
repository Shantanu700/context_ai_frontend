"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCwIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";

import { StageToggles } from "@/components/stage-toggles";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { videosScenesList, type Scene, type VideoList } from "@/lib/api";
import {
  formatDuration,
  isActive,
  labelFor,
  mediaSrc,
  reprocessVideo,
  thumbnailSrc,
  videoSrc,
  type Stages,
} from "@/lib/videos";

export function VideoPreview({
  video,
  onReprocessed,
}: {
  video: VideoList | null;
  onReprocessed: () => void;
}) {
  if (!video) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm">Nothing selected</p>
        <p className="text-xs text-muted-foreground">
          Pick a video from the queue to play it and read its scenes.
        </p>
      </div>
    );
  }

  return <Preview key={video.uuid} video={video} onReprocessed={onReprocessed} />;
}

function Preview({
  video,
  onReprocessed,
}: {
  video: VideoList;
  onReprocessed: () => void;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [stages, setStages] = useState<Stages>({
    detect_scenes: false,
    transcribe: false,
    analyze: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uuid, status, scenes_done, scenes_total } = video;
  const busy = isActive(video);
  const src = videoSrc(video);

  // Keyed on scenes_done so rows fill in as the analysis chord reports back.
  useEffect(() => {
    // Nothing to fetch, and SceneList renders the empty case off `total` alone.
    if (!scenes_total) return;

    let cancelled = false;
    void videosScenesList({ path: { uuid } }).then(({ data, response }) => {
      if (!cancelled && data && response?.ok) setScenes(data);
    });
    return () => {
      cancelled = true;
    };
  }, [uuid, status, scenes_done, scenes_total]);

  async function rerun() {
    setPending(true);
    setError(null);
    const result = await reprocessVideo(uuid, stages);
    setPending(false);
    if (result.ok) onReprocessed();
    else setError(result.message);
  }

  function seekTo(seconds: number) {
    const el = player.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play().catch(() => {
      // Autoplay policies can refuse; the seek still landed.
    });
  }

  const nothingChecked = !Object.values(stages).some(Boolean);
  // detect_scenes rebuilds every Scene row from scratch, so any analysis
  // already on them is discarded. Say so before they click.
  const willDiscard = stages.detect_scenes && (scenes_total ?? 0) > 0;

  return (
    <>
      {src ? (
        <VideoPlayer
          ref={player}
          src={src}
          poster={thumbnailSrc(video) ?? undefined}
        />
      ) : (
        <div className="well relative aspect-video w-full shrink-0 overflow-hidden rounded-lg">
          <Placeholder video={video} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="truncate text-[15px] leading-6 font-semibold">
          {labelFor(uuid)}
        </h3>

        <StageToggles
          idPrefix="rerun"
          value={stages}
          onChange={setStages}
          disabled={busy || pending}
        />

        {willDiscard && (
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            <span>
              Re-detecting rebuilds every scene, discarding the descriptions and
              ad matches already on them.
            </span>
          </p>
        )}

        <Button
          variant="signal"
          size="sm"
          disabled={busy || pending || nothingChecked}
          onClick={rerun}
        >
          {pending ? <Loader2 className="animate-spin" /> : <RotateCwIcon />}
          {busy ? "Processing…" : "Re-run selected stages"}
        </Button>

        {error && (
          <p
            role="alert"
            className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
          >
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>

      <SceneList scenes={scenes} total={scenes_total ?? 0} onSeek={seekTo} />
    </>
  );
}

/** No playable file yet — the worker stores it partway through a URL fetch. */
function Placeholder({ video }: { video: VideoList }) {
  const thumb = thumbnailSrc(video);
  return (
    <div className="flex size-full items-center justify-center">
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
        <img src={thumb} alt="" className="size-full object-cover opacity-40" />
      )}
      <p className="absolute text-xs text-muted-foreground">
        {isActive(video) ? "Fetching the video…" : "No playable file for this video."}
      </p>
    </div>
  );
}

function SceneList({
  scenes,
  total,
  onSeek,
}: {
  scenes: Scene[] | null;
  total: number;
  onSeek: (seconds: number) => void;
}) {
  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No scenes yet. Run scene detection to break this video up.
      </p>
    );
  }
  if (scenes === null) {
    return <p className="text-xs text-muted-foreground">Loading scenes…</p>;
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <h4 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Scenes
      </h4>
      <ul className="flex flex-col gap-1">
        {scenes.map((scene) => (
          <li key={scene.index}>
            <button
              type="button"
              onClick={() => onSeek(scene.start)}
              className="flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-raised/60 focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none"
            >
              <Keyframes urls={scene.keyframe_urls} index={scene.index} />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span data-numeric className="text-xs text-muted-foreground">
                    {formatDuration(scene.start)}–{formatDuration(scene.end)}
                  </span>
                  {scene.tone && (
                    <span className="rounded-sm bg-raised px-1.5 py-0.5 text-[11px] leading-snug text-muted-foreground">
                      {scene.tone}
                    </span>
                  )}
                  {scene.brand_safety_flag && (
                    <span className="flex items-center gap-1 text-[11px] text-destructive">
                      <ShieldAlertIcon className="size-3" />
                      Brand safety
                    </span>
                  )}
                </div>

                {scene.description ? (
                  <p className="line-clamp-2 text-sm">{scene.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not analyzed yet</p>
                )}

                {scene.transcript_text && (
                  <p className="line-clamp-2 text-xs text-muted-foreground italic">
                    “{scene.transcript_text}”
                  </p>
                )}

                {scene.recommended_ad && (
                  <p className="text-xs text-synth">
                    {scene.recommended_ad.brand} — {scene.recommended_ad.title}
                    {scene.match_score != null && (
                      <span data-numeric className="ml-1.5 text-muted-foreground">
                        {Math.round(scene.match_score * 100)}%
                      </span>
                    )}
                  </p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Keyframes({ urls, index }: { urls: string[]; index: number }) {
  return (
    <div className="well relative aspect-video w-24 shrink-0 overflow-hidden rounded-md">
      {urls[0] && (
        // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
        <img
          src={mediaSrc(urls[0]) ?? undefined}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      {/* Glass is legal here: it sits on the frame, not on the stage. */}
      <span
        data-numeric
        className="glass absolute top-1 left-1 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug"
      >
        {index}
      </span>
    </div>
  );
}

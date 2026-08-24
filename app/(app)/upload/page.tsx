"use client";

import { useRef, useState } from "react";
import { Loader2, LinkIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";

import { StageToggles } from "@/components/stage-toggles";
import { VideoPreview } from "@/components/video-preview";
import { VideoQueue } from "@/components/video-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVideos } from "@/hooks/use-videos";
import {
  ALL_STAGES,
  createVideoFromUrl,
  rememberLabel,
  uploadVideoFile,
  type CreateResult,
  type Stages,
} from "@/lib/videos";

type Uploading = { name: string; fraction: number; index: number; total: number };

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<Uploading | null>(null);
  const [urlPending, setUrlPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Matches VideoCreateSerializer, where all three default to true.
  const [stages, setStages] = useState<Stages>(ALL_STAGES);
  const [selected, setSelected] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { videos, refresh, remove } = useVideos();
  const selectedVideo = videos?.find((v) => v.uuid === selected) ?? null;

  function settle(result: CreateResult, label: string) {
    if (result.ok) {
      rememberLabel(result.video.uuid, label);
      refresh();
      return true;
    }
    setError(result.message);
    return false;
  }

  async function uploadAll(files: File[]) {
    setError(null);

    // The server has no MIME, extension, or size check at all — a .txt gets a
    // cheerful 202 and only fails minutes later inside the worker. Catch it here.
    const videos = files.filter((f) => f.type.startsWith("video/"));
    const rejected = files.length - videos.length;
    if (rejected > 0) {
      setError(
        `Skipped ${rejected} file${rejected > 1 ? "s" : ""} that ${
          rejected > 1 ? "are" : "is"
        } not video.`,
      );
    }
    if (videos.length === 0) return;

    // One file per request, so they go up in sequence.
    for (const [index, file] of videos.entries()) {
      setUploading({
        name: file.name,
        fraction: 0,
        index: index + 1,
        total: videos.length,
      });
      const { promise } = uploadVideoFile(file, stages, (fraction) =>
        setUploading((current) => (current ? { ...current, fraction } : current)),
      );
      const result = await promise;
      if (!settle(result, file.name)) break;
    }
    setUploading(null);
  }

  async function onSubmitUrl(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get("source_url") ?? "").trim();
    if (!url) return;

    setUrlPending(true);
    setError(null);
    const result = await createVideoFromUrl(url, stages);
    setUrlPending(false);
    if (settle(result, url)) form.reset();
  }

  const busy = uploading !== null;

  return (
    // Laptop: upload over queue in a fixed column, preview fills the rest.
    // Narrow: upload, preview, queue stacked — DOM order, no `order` needed.
    <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <section className="panel flex flex-col gap-4 p-4 lg:col-start-1 lg:row-start-1">
        <h1 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Upload
        </h1>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void uploadAll(Array.from(e.dataTransfer.files));
          }}
          className={`well flex flex-col items-center justify-center gap-2 px-4 py-8 text-center transition-colors ${
            dragging ? "ring-1 ring-signal" : ""
          }`}
        >
          <UploadIcon className="size-5 text-muted-foreground" />
          <p className="text-sm">Drop a video here</p>
          <p className="text-xs text-muted-foreground">
            It starts processing as soon as it lands.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-1"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Choose files
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => {
              void uploadAll(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Run on new videos
          </p>
          <StageToggles
            idPrefix="upload"
            value={stages}
            onChange={setStages}
            disabled={busy || urlPending}
          />
        </div>

        {uploading && (
          <div>
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
              <span className="truncate">{uploading.name}</span>
              <span data-numeric className="ml-auto shrink-0 text-muted-foreground">
                {uploading.total > 1 && `${uploading.index}/${uploading.total} · `}
                {Math.round(uploading.fraction * 100)}%
              </span>
            </div>
            <div className="well mt-2 h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-signal transition-[width]"
                style={{ width: `${uploading.fraction * 100}%` }}
              />
            </div>
          </div>
        )}

        <form onSubmit={onSubmitUrl} className="flex flex-col gap-2">
          <label
            htmlFor="source_url"
            className="text-xs font-medium text-muted-foreground"
          >
            Or fetch from a URL
          </label>
          <Input
            id="source_url"
            name="source_url"
            type="url"
            placeholder="https://example.com/clip.mp4"
            disabled={busy || urlPending}
            aria-describedby={error ? "upload-error" : undefined}
          />
          <Button
            type="submit"
            variant="signal"
            size="sm"
            disabled={busy || urlPending}
          >
            {urlPending ? <Loader2 className="animate-spin" /> : <LinkIcon />}
            {urlPending ? "Fetching…" : "Fetch video"}
          </Button>
        </form>

        {error && (
          <p
            id="upload-error"
            role="alert"
            className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
          >
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </section>

      <section className="panel flex min-h-80 min-w-0 flex-col gap-4 overflow-y-auto p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Preview
        </h2>
        <VideoPreview video={selectedVideo} onReprocessed={refresh} />
      </section>

      {/* Fixed box: the heading stays put, the list scrolls inside it. */}
      <section className="panel flex h-72 flex-col gap-4 overflow-hidden p-4 lg:col-start-1 lg:row-start-2 lg:h-auto">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Queue
        </h2>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <VideoQueue
            videos={videos}
            selected={selected}
            onSelect={setSelected}
            onRemove={(uuid) => {
              if (uuid === selected) setSelected(null);
              void remove(uuid);
            }}
          />
        </div>
      </section>
    </div>
  );
}

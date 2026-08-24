"use client";

import Link from "next/link";
import {
  ClapperboardIcon,
  CloudUploadIcon,
  Loader2,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVideos } from "@/hooks/use-videos";
import { formatTimecode } from "@/lib/slots";
import { describeStatus, isActive, labelFor, thumbnailSrc } from "@/lib/videos";
import type { VideoList } from "@/lib/api";

const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export default function ProjectsPage() {
  const { videos } = useVideos();

  return (
    <section className="panel flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Projects
        </h1>
        {videos && (
          <span data-numeric className="text-[11px] text-muted-foreground">
            {videos.length}
          </span>
        )}
      </div>

      {videos === null ? (
        <div className={GRID}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Empty />
      ) : (
        <ul className={GRID}>
          {videos.map((video) => (
            <li key={video.uuid}>
              <Card video={video} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <ClapperboardIcon className="size-6 text-muted-foreground" />
      <div>
        <p className="text-sm">Nothing to edit yet</p>
        <p className="text-xs text-muted-foreground">
          Upload a video and the pipeline will break it into scenes and match ads to them.
        </p>
      </div>
      <Button render={<Link href="/upload" />} variant="signal" size="sm">
        <CloudUploadIcon />
        Upload a video
      </Button>
    </div>
  );
}

/**
 * Only a finished video opens in the editor. One still analyzing has no ad
 * recommendations to place yet, so the card reports progress instead of linking
 * somewhere that would be empty.
 */
function Card({ video }: { video: VideoList }) {
  const status = describeStatus(video);
  const ready = video.status === "done";
  const body = (
    <>
      <div className="well relative aspect-video w-full overflow-hidden rounded-lg">
        <Thumbnail video={video} />

        {video.duration != null && (
          <span
            data-numeric
            className="glass absolute right-1.5 bottom-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug"
          >
            {formatTimecode(video.duration)}
          </span>
        )}

        {isActive(video) && (
          <span className="glass absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug">
            <Loader2 className="size-3 animate-spin" />
            {status.percent != null ? `${status.percent}%` : "Working"}
          </span>
        )}

        {video.status === "failed" && (
          <span className="glass absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11px] leading-snug text-destructive">
            <TriangleAlertIcon className="size-3" />
            Failed
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{labelFor(video.uuid)}</p>
        <p className="truncate text-xs text-muted-foreground">{status.label}</p>
      </div>

      {status.percent != null && status.percent < 100 && (
        <div className="well h-1 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-signal transition-[width]"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      )}
    </>
  );

  const shell = "flex flex-col gap-2 rounded-xl p-2 text-left transition-colors";

  if (!ready) {
    return <div className={`${shell} opacity-70`}>{body}</div>;
  }

  return (
    <Link
      href={`/editor/${video.uuid}`}
      className={`${shell} hover:bg-raised/60 focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}

function Thumbnail({ video }: { video: VideoList }) {
  const src = thumbnailSrc(video);
  if (!src) {
    return (
      <div className="grid size-full place-items-center">
        <ClapperboardIcon className="size-5 text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- API host isn't in an images config, and R2 URLs are presigned
    <img src={src} alt="" className="size-full object-cover" loading="lazy" />
  );
}

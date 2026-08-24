"use client";

import { useState } from "react";
import { InfoIcon, ShieldAlertIcon, SparklesIcon, XIcon } from "lucide-react";

import { formatTimecode } from "@/lib/slots";
import type { Scene } from "@/lib/api";

/**
 * What the model saw at the playhead, behind a toggle.
 *
 * Kept shut by default: the panel covers a third of the frame, and the operator is
 * mostly watching the footage, not reading about it.
 *
 * Glass is legal here: it sits on the frame, not on the stage (globals.css).
 * `glass-strong` for the open panel because it carries body copy over footage.
 *
 * Every row below is a field the API actually returns. The pipeline computes no
 * drop-off risk, sentiment shift or silence gap, so none is shown — a confident
 * number with nothing behind it is worse than a missing row.
 */
export function SceneCard({ scene }: { scene: Scene | null }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-label="Show scene analysis"
        className="glass glass-interactive absolute top-3 right-3 grid size-8 place-items-center rounded-full"
      >
        <InfoIcon className="size-4" />
        {/* The one signal worth surfacing without a click. */}
        {scene?.brand_safety_flag && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive"
          />
        )}
      </button>
    );
  }

  return (
    <div className="glass-strong absolute top-3 right-3 flex max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-synth text-synth-foreground">
          <SparklesIcon className="size-3.5" />
        </span>
        <span className="text-sm font-medium">Scene analysis</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded
          aria-label="Hide scene analysis"
          className="-mr-1 ml-auto shrink-0 rounded-full p-1 transition-colors hover:bg-white/20 focus-visible:ring-1 focus-visible:ring-signal focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {scene ? <Body scene={scene} /> : <Empty />}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-white/70">No scene at the playhead.</p>;
}

function Body({ scene }: { scene: Scene }) {
  const objects = (scene.objects_seen as string[] | null) ?? [];
  const categories = (scene.iab_categories as string[] | null) ?? [];

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-[11px] text-white/60">
          {formatTimecode(scene.start)}–{formatTimecode(scene.end)}
        </span>
        {scene.brand_safety_flag && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-destructive">
            <ShieldAlertIcon className="size-3" />
            Brand safety
          </span>
        )}
      </div>

      {scene.description ? (
        <p className="text-xs leading-relaxed text-white/85">{scene.description}</p>
      ) : (
        <p className="text-xs text-white/60">This scene hasn&apos;t been analyzed yet.</p>
      )}

      {objects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {objects.map((object) => (
            <span
              key={object}
              className="rounded-sm bg-white/12 px-1.5 py-0.5 text-[11px] leading-snug text-white/80"
            >
              {object}
            </span>
          ))}
        </div>
      )}

      <dl className="flex flex-col gap-1.5 border-t border-white/12 pt-2.5">
        <Signal label="Scene" value={`#${scene.index}`} />
        {scene.tone && <Signal label="Tone" value={scene.tone} />}
        {scene.match_score != null && (
          <Signal
            label="Topic match"
            value={`${scene.match_score.toFixed(2)} cosine`}
            tint="text-signal"
          />
        )}
        {categories.length > 0 && (
          <Signal label="Categories" value={categories.join(", ")} />
        )}
      </dl>

      {scene.transcript_text && (
        <p className="line-clamp-3 border-t border-white/12 pt-2.5 text-[11px] leading-relaxed text-white/60 italic">
          “{scene.transcript_text}”
        </p>
      )}
    </>
  );
}

function Signal({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 text-[11px] leading-snug">
      <dt className="shrink-0 text-white/55">{label}</dt>
      <dd
        data-numeric
        className={`ml-auto min-w-0 truncate text-right ${tint ?? "text-white/85"}`}
      >
        {value}
      </dd>
    </div>
  );
}

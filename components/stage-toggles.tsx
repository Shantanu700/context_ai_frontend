"use client";

import { Switch } from "@/components/ui/switch";
import type { Stages } from "@/lib/videos";

/** Wire key → label. Order matches the order the worker runs them in. */
const STAGES: [keyof Stages, string][] = [
  ["detect_scenes", "Detect scenes"],
  ["transcribe", "Transcribe audio"],
  ["analyze", "Analyze scenes"],
];

/**
 * The three pipeline switches. Used twice: choosing what to run on a new upload,
 * and choosing what to re-run on a stored video.
 */
export function StageToggles({
  value,
  onChange,
  disabled,
  idPrefix,
}: {
  value: Stages;
  onChange: (stages: Stages) => void;
  disabled?: boolean;
  /** Both copies can be on screen at once, so the label/input ids must differ. */
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {STAGES.map(([key, label]) => {
        const id = `${idPrefix}-${key}`;
        return (
          <label
            key={key}
            htmlFor={id}
            className="flex items-center justify-between gap-2.5 text-sm has-disabled:opacity-50"
          >
            {label}
            <Switch
              id={id}
              checked={value[key]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...value, [key]: checked })}
            />
          </label>
        );
      })}
    </div>
  );
}

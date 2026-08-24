import type { PlacementEnum, StateEnum } from "@/lib/api";

/**
 * How a slot's state reads, everywhere it appears.
 *
 * Follows the house rule in globals.css: synth (violet) is what the model authored,
 * signal (cyan) is what the operator committed. So a suggestion arrives violet and
 * turns cyan the moment it is accepted — the colour is the decision.
 *
 * `block` is the whole treatment for a slot with nothing behind it. A slot showing its
 * creative takes `edge` and `tint` instead: the frame has to stay readable, so the state
 * becomes a border and a wash over it rather than the fill. Written out rather than
 * derived from `block`, because Tailwind only sees class names that appear literally.
 */
export const STATE_STYLE: Record<
  StateEnum,
  { label: string; chip: string; block: string; edge: string; tint: string; dot: string }
> = {
  suggested: {
    label: "Suggested",
    chip: "bg-synth/15 text-synth",
    block: "bg-synth/25 border-synth/50 hover:bg-synth/35",
    edge: "border-synth/50",
    tint: "bg-synth/25",
    dot: "bg-synth",
  },
  accepted: {
    label: "Accepted",
    chip: "bg-signal/15 text-signal",
    block: "bg-signal/25 border-signal/50 hover:bg-signal/35",
    edge: "border-signal/50",
    tint: "bg-signal/25",
    dot: "bg-signal",
  },
  held: {
    label: "Held",
    chip: "bg-chart-4/15 text-chart-4",
    block: "bg-chart-4/20 border-chart-4/50 hover:bg-chart-4/30",
    edge: "border-chart-4/50",
    tint: "bg-chart-4/20",
    dot: "bg-chart-4",
  },
  rejected: {
    label: "Rejected",
    chip: "bg-raised text-muted-foreground",
    block: "bg-raised/60 border-border hover:bg-raised",
    edge: "border-border",
    tint: "bg-raised/60",
    dot: "bg-muted-foreground",
  },
};

/**
 * An overlay at rest wears mint rather than synth violet, so the two operator-owned lanes
 * read apart at a glance. Only the resting state diverges: an accepted overlay is still
 * signal cyan, because the rule above is that cyan means the operator committed it.
 * Written out literally, not derived — Tailwind only sees class names that appear as text.
 */
const OVERLAY_SUGGESTED = {
  ...STATE_STYLE.suggested,
  chip: "bg-chart-3/15 text-chart-3",
  block: "bg-chart-3/25 border-chart-3/50 hover:bg-chart-3/35",
  edge: "border-chart-3/50",
  tint: "bg-chart-3/25",
  dot: "bg-chart-3",
};

/** How one slot reads. Takes the two fields rather than a `Slot`, so this file keeps
 *  importing nothing but types. */
export function slotStyle(state: StateEnum, isOverlay: boolean) {
  return isOverlay && state === "suggested" ? OVERLAY_SUGGESTED : STATE_STYLE[state];
}

export const PLACEMENT_LABEL: Record<PlacementEnum, string> = {
  pre_roll: "Pre-roll",
  mid_roll: "Mid-roll",
  post_roll: "Post-roll",
};

/** The neutral chip used for tags that carry no state — tone, objects, categories. */
export const CHIP =
  "rounded-sm bg-raised px-1.5 py-0.5 text-[11px] leading-snug text-muted-foreground";

export const EYEBROW =
  "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase";

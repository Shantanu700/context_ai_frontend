import {
  type Ad,
  type AdSlot,
  type AdSlotRequest,
  type PlacementEnum,
  type Scene,
  type StateEnum,
  type VideoList,
} from "@/lib/api";
import { labelFor } from "@/lib/videos";

/**
 * A slot as the editor holds it.
 *
 * `key` rather than the server's `id` because `PUT /videos/{uuid}/slots` replaces the
 * whole list and hands back fresh ids every save. A slot being dragged must keep its
 * identity across that, and a slot the operator just added has no id at all yet.
 */
export type Slot = {
  key: string;
  scene: number | null;
  ad: number | null;
  ad_detail: Ad | null;
  at_seconds: number;
  duration: number;
  placement: PlacementEnum;
  is_overlay: boolean;
  state: StateEnum;
  score: number | null;
};

export const DEFAULT_DURATION = 15;
export const DURATION_PRESETS = [6, 15, 30];
/** Below this a half is unsellable, and its block is too small to grab back. */
export const MIN_SLOT_DURATION = 1;
/** Longest break worth selling. Beside the floor, because a trim handle honours both. */
export const MAX_SLOT_DURATION = 60;

/** Mirrors `placement_for` in core/slots.py, so a dragged slot relabels itself the way a seeded one was labelled. */
const EDGE_FRACTION = 0.05;

export function placementFor(
  atSeconds: number,
  duration: number | null | undefined,
): PlacementEnum {
  if (!duration || duration <= 0) return "mid_roll";
  if (atSeconds <= duration * EDGE_FRACTION) return "pre_roll";
  if (atSeconds >= duration * (1 - EDGE_FRACTION)) return "post_roll";
  return "mid_roll";
}

function newKey(): string {
  // randomUUID needs a secure context; http://<lan-ip>:3000 is not one.
  return globalThis.crypto?.randomUUID?.() ?? `slot-${Math.random().toString(36).slice(2)}`;
}

export function fromApi(slot: AdSlot): Slot {
  return {
    key: `id-${slot.id}`,
    scene: slot.scene ?? null,
    ad: slot.ad ?? null,
    // the serializer nulls this out with the ad; the generated type doesn't say so
    ad_detail: (slot.ad_detail as Ad | null) ?? null,
    at_seconds: slot.at_seconds,
    duration: slot.duration ?? DEFAULT_DURATION,
    placement: slot.placement ?? "mid_roll",
    is_overlay: slot.is_overlay ?? false,
    state: slot.state ?? "suggested",
    score: slot.score ?? null,
  };
}

export function toRequest(slot: Slot): AdSlotRequest {
  return {
    scene: slot.scene,
    ad: slot.ad,
    at_seconds: slot.at_seconds,
    duration: slot.duration,
    placement: slot.placement,
    is_overlay: slot.is_overlay,
    state: slot.state,
    score: slot.score,
  };
}

export function blankSlot(
  atSeconds: number,
  video: VideoList | null,
  patch?: Partial<Slot>,
): Slot {
  return {
    key: newKey(),
    scene: null,
    ad: null,
    ad_detail: null,
    at_seconds: atSeconds,
    duration: DEFAULT_DURATION,
    placement: placementFor(atSeconds, video?.duration),
    is_overlay: false,
    // a hand-placed slot was never suggested by anything — it is already the
    // operator's decision, it just has no creative attached yet
    state: "accepted",
    score: null,
    ...patch,
  };
}

/** True when a cut at `at` would leave two usable halves. Called every frame — keep it cheap. */
export function canSplitAt(slot: Slot | null, at: number): boolean {
  if (!slot) return false;
  return (
    at - slot.at_seconds >= MIN_SLOT_DURATION &&
    slot.at_seconds + slot.duration - at >= MIN_SLOT_DURATION
  );
}

/**
 * Cut one slot in two at `at`. Null when the cut wouldn't leave two usable halves.
 *
 * The tail keeps the ad, the state and the score: a split is one break becoming two,
 * not a new empty slot next to the old one. Only the key and the placement are re-derived.
 */
export function splitSlot(
  slot: Slot,
  at: number,
  videoDuration?: number | null,
): [Slot, Slot] | null {
  if (!canSplitAt(slot, at)) return null;
  return [
    { ...slot, duration: at - slot.at_seconds },
    {
      ...slot,
      key: newKey(),
      at_seconds: at,
      duration: slot.at_seconds + slot.duration - at,
      placement: placementFor(at, videoDuration),
    },
  ];
}

type Placed = Pick<Slot, "at_seconds" | "duration">;

/** Enough of a slot to ask where it may sit. A probe for a slot that doesn't exist yet
 *  has no key, which is fine: no real slot's key matches `undefined`. */
type Span = Placed & { key?: string; is_overlay: boolean };

/**
 * The room a slot has to itself: the gap between its neighbours, inside the video.
 *
 * Only slots on the same lane compete — an overlay and a video break at the same second
 * are the whole point, they just can't be two breaks. Neighbours are partitioned by where
 * the slot sits *now*, which stays stable across a drag precisely because the clamp stops
 * it from ever reaching the far side of one.
 */
function roomFor(slots: Slot[], slot: Span, videoDuration: number) {
  let low = 0;
  // A slot already running past the last frame keeps its length; it just can't grow.
  let high = Math.max(videoDuration, slot.at_seconds + slot.duration);
  for (const other of slots) {
    if (other.key === slot.key || other.is_overlay !== slot.is_overlay) continue;
    if (other.at_seconds <= slot.at_seconds) {
      low = Math.max(low, other.at_seconds + other.duration);
    } else {
      high = Math.min(high, other.at_seconds);
    }
  }
  // Slots seeded before this rule existed can already overlap. Never return an
  // inverted range — the callers would produce nonsense from it.
  return { low, high: Math.max(high, low + MIN_SLOT_DURATION) };
}

/** Slide a slot to `atSeconds`, stopping hard against whichever neighbour it reaches first. */
export function placeSlot(
  slots: Slot[],
  slot: Slot,
  atSeconds: number,
  videoDuration: number,
): Placed {
  const { low, high } = roomFor(slots, slot, videoDuration);
  return {
    at_seconds: clamp(atSeconds, low, high - slot.duration),
    duration: slot.duration,
  };
}

/**
 * Drag one edge of a slot to `time`; the opposite edge stays where it is.
 *
 * All the clamping lives here rather than in the drag hook so the bounds are one
 * readable set of rules and can be tested without a pointer.
 */
export function trimSlot(
  slots: Slot[],
  slot: Slot,
  edge: "start" | "end",
  time: number,
  videoDuration: number,
): Placed {
  const { low, high } = roomFor(slots, slot, videoDuration);
  if (edge === "end") {
    const duration = clamp(
      time - slot.at_seconds,
      MIN_SLOT_DURATION,
      Math.min(MAX_SLOT_DURATION, high - slot.at_seconds),
    );
    return { at_seconds: slot.at_seconds, duration };
  }
  const end = slot.at_seconds + slot.duration;
  const at = clamp(time, Math.max(low, end - MAX_SLOT_DURATION), end - MIN_SLOT_DURATION);
  return { at_seconds: at, duration: end - at };
}

/**
 * Whether a new slot may start at `at` on that lane: the second has to be free, with at
 * least a usable slot's worth of room after it. What the add buttons grey out on, so the
 * control says no before the click does nothing. Called every frame — keep it cheap.
 */
export function canAddAt(
  slots: Slot[],
  at: number,
  isOverlay: boolean,
  videoDuration: number,
): boolean {
  const probe: Span = { at_seconds: at, duration: MIN_SLOT_DURATION, is_overlay: isOverlay };
  const { low, high } = roomFor(slots, probe, videoDuration);
  return at >= low && high - at >= MIN_SLOT_DURATION;
}

/**
 * Fit a freshly-added slot into the gap it was dropped in, shortening it if that is all
 * the room there is. Null when that second is already taken.
 *
 * It never slides the slot to the next free gap: the operator pointed at a time, and a
 * break appearing half a minute from where they pointed is worse than none appearing.
 */
export function fitNewSlot(
  slots: Slot[],
  slot: Slot,
  videoDuration: number,
): Slot | null {
  if (!canAddAt(slots, slot.at_seconds, slot.is_overlay, videoDuration)) return null;
  const { high } = roomFor(slots, slot, videoDuration);
  return { ...slot, duration: Math.min(slot.duration, high - slot.at_seconds) };
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/**
 * Where each of a scene's keyframes was taken, so the strip can seek to the frame
 * under the cursor. Mirrors `keyframe_times` in core/media.py: the backend spaces
 * 1-3 frames evenly *inside* the scene, never on a cut, and only hands back the URLs.
 */
export function keyframeTimes(scene: Scene): number[] {
  const length = scene.end - scene.start;
  const n = scene.keyframe_urls.length;
  return scene.keyframe_urls.map((_, i) => scene.start + (length * (i + 1)) / (n + 1));
}

/** The scene playing at `seconds`, or null before the first / after the last. */
export function sceneAt(scenes: Scene[] | null, seconds: number): Scene | null {
  if (!scenes) return null;
  return (
    scenes.find((scene) => seconds >= scene.start && seconds < scene.end) ?? null
  );
}

/** Every scene boundary, for snapping and for the timeline's scene lane. */
export function sceneCuts(scenes: Scene[] | null): number[] {
  if (!scenes) return [0];
  return [0, ...scenes.map((s) => s.start), ...scenes.map((s) => s.end)];
}

export function sortByTime(slots: Slot[]): Slot[] {
  return [...slots].sort((a, b) => a.at_seconds - b.at_seconds);
}

/** `H:MM:SS`. The video is long enough that `M:SS` from lib/videos.ts stops reading cleanly. */
export function formatTimecode(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * The handoff file: the accepted plan, and enough about the source to act on it.
 *
 * Not an EDL — ad slots are insertion points, not cuts, and forcing them into CMX3600
 * would lose the placement and the creative. Whatever renders this later wants the
 * timecodes and the ad ids, which is what this carries.
 */
export function exportManifest(
  video: VideoList,
  slots: Slot[],
): { filename: string; json: string } {
  const accepted = sortByTime(slots.filter((s) => s.state === "accepted"));
  const manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    video: {
      uuid: video.uuid,
      label: labelFor(video.uuid),
      duration: video.duration ?? null,
    },
    slots: accepted.map((slot) => ({
      at_seconds: Number(slot.at_seconds.toFixed(3)),
      timecode: formatTimecode(slot.at_seconds),
      duration: slot.duration,
      placement: slot.placement,
      break_type: slot.is_overlay ? "overlay" : "video_break",
      score: slot.score,
      ad: slot.ad_detail
        ? {
            id: slot.ad_detail.id,
            brand: slot.ad_detail.brand,
            title: slot.ad_detail.title,
            ad_type: slot.ad_detail.ad_type,
            asset_url: slot.ad_detail.asset_url,
          }
        : null,
    })),
  };
  return {
    filename: `${labelFor(video.uuid).replace(/[^\w.-]+/g, "_")}-ad-plan.json`,
    json: JSON.stringify(manifest, null, 2),
  };
}

/** Hands the manifest to the browser as a download. */
export function downloadManifest(video: VideoList, slots: Slot[]) {
  const { filename, json } = exportManifest(video, slots);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

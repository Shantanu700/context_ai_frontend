"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  UNREACHABLE,
  videosRetrieve,
  videosScenesList,
  videosSlotsList,
  videosSlotsUpdate,
  readDrfError,
  type Scene,
  type VideoList,
} from "@/lib/api";
import {
  blankSlot,
  fitNewSlot,
  fromApi,
  sortByTime,
  splitSlot,
  toRequest,
  type Slot,
} from "@/lib/slots";

/** Long enough that a drag or a burst of clicks is one request, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 600;
/** seq's undo stack is unbounded; a long session there grows without limit. Cap it. */
const HISTORY_LIMIT = 50;

export type SaveState = "idle" | "saving" | "error";

/**
 * Everything the editor holds for one video.
 *
 * One hook rather than a state library: the document is a flat list of a few dozen
 * slots, and the only cross-cutting concern is "push it to the server after it settles".
 */
export function useEditor(uuid: string) {
  const [video, setVideo] = useState<VideoList | null>(null);
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [past, setPast] = useState<Slot[][]>([]);
  const [future, setFuture] = useState<Slot[][]>([]);

  /* ---- loading ---- */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [videoRes, scenesRes, slotsRes] = await Promise.all([
        videosRetrieve({ path: { uuid } }),
        videosScenesList({ path: { uuid } }),
        videosSlotsList({ path: { uuid } }),
      ]);
      if (cancelled) return;

      if (!videoRes.response) {
        setLoadError(UNREACHABLE);
        return;
      }
      if (!videoRes.data || !videoRes.response.ok) {
        setLoadError(
          videoRes.response.status === 404
            ? "That video doesn't exist, or isn't yours."
            : `Couldn't load the video (status ${videoRes.response.status}).`,
        );
        return;
      }

      setVideo(videoRes.data);
      setScenes(scenesRes.data ?? []);
      setSlots(sortByTime((slotsRes.data ?? []).map(fromApi)));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  /* ---- saving ----
     The whole list goes up on every change. It is a few dozen small rows, and it
     makes undo a plain PUT of an earlier snapshot instead of a diff. */

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<Slot[] | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async () => {
    const next = queued.current;
    if (!next) return;
    queued.current = null;

    // Serialize the writes. Two overlapping whole-list PUTs can land out of order,
    // and the loser silently becomes the stored plan.
    const send = (async () => {
      await inFlight.current;
      setSaveState("saving");
      const { response } = await videosSlotsUpdate({
        path: { uuid },
        body: next.map(toRequest),
      });
      if (response?.ok) {
        setSaveState("idle");
        setSaveError(null);
      } else {
        setSaveState("error");
        let body: unknown = null;
        try {
          body = await response?.clone().json();
        } catch {
          // no JSON body — readDrfError falls back to the status
        }
        setSaveError(
          !response
            ? UNREACHABLE
            : readDrfError(body, response.status),
        );
      }
    })();
    inFlight.current = send;
    await send;
  }, [uuid]);

  const queueSave = useCallback(
    (next: Slot[]) => {
      queued.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Leaving the page with an edit still in the debounce window would lose it.
  useEffect(() => {
    const onHide = () => {
      if (queued.current) void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  /* ---- editing ---- */

  const commit = useCallback(
    (next: Slot[], record = true) => {
      if (record) {
        setPast((stack) => [...stack, slots ?? []].slice(-HISTORY_LIMIT));
        setFuture([]);
      }
      setSlots(next);
      queueSave(next);
    },
    [slots, queueSave],
  );

  /** Take an undo snapshot without changing anything — call once at the start of a drag. */
  const snapshot = useCallback(() => {
    setPast((stack) => [...stack, slots ?? []].slice(-HISTORY_LIMIT));
    setFuture([]);
  }, [slots]);

  const update = useCallback(
    (key: string, patch: Partial<Slot>, record = true) => {
      if (!slots) return;
      commit(
        slots.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)),
        record,
      );
    },
    [slots, commit],
  );

  const add = useCallback(
    (atSeconds: number, patch?: Partial<Slot>) => {
      if (!slots) return;
      // Shortened to whatever gap it lands in, and refused outright when the lane is
      // already full at that second — two breaks may not sit on top of each other.
      const slot = fitNewSlot(slots, blankSlot(atSeconds, video, patch), video?.duration ?? 0);
      if (!slot) return;
      commit(sortByTime([...slots, slot]));
      setSelectedKey(slot.key);
    },
    [slots, video, commit],
  );

  const remove = useCallback(
    (key: string) => {
      if (!slots) return;
      commit(slots.filter((slot) => slot.key !== key));
      setSelectedKey((current) => (current === key ? null : current));
    },
    [slots, commit],
  );

  /** Scissors: one break becomes two at the playhead. No-ops if the cut leaves a stub. */
  const split = useCallback(
    (key: string, atSeconds: number) => {
      if (!slots) return;
      const slot = slots.find((s) => s.key === key);
      if (!slot) return;
      const halves = splitSlot(slot, atSeconds, video?.duration);
      if (!halves) return;
      commit(sortByTime([...slots.filter((s) => s.key !== key), ...halves]));
      // Select the tail: the head is where you were, the tail is the new thing to place.
      setSelectedKey(halves[1].key);
    },
    [slots, video?.duration, commit],
  );

  /** The bulk-accept slider: everything the model was at least `threshold` sure of. */
  const acceptAbove = useCallback(
    (threshold: number) => {
      if (!slots) return;
      commit(
        slots.map((slot) =>
          slot.state === "suggested" && (slot.score ?? 0) >= threshold
            ? { ...slot, state: "accepted" }
            : slot,
        ),
      );
    },
    [slots, commit],
  );

  const undo = useCallback(() => {
    if (past.length === 0 || !slots) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((stack) => [slots, ...stack]);
    setSlots(previous);
    queueSave(previous);
  }, [past, slots, queueSave]);

  const redo = useCallback(() => {
    if (future.length === 0 || !slots) return;
    const [next, ...rest] = future;
    setPast((stack) => [...stack, slots].slice(-HISTORY_LIMIT));
    setFuture(rest);
    setSlots(next);
    queueSave(next);
  }, [future, slots, queueSave]);

  const selected = slots?.find((slot) => slot.key === selectedKey) ?? null;

  return {
    video,
    scenes,
    slots,
    selected,
    selectedKey,
    select: setSelectedKey,
    loading: slots === null && loadError === null,
    loadError,
    saveState,
    saveError,
    snapshot,
    update,
    add,
    remove,
    split,
    acceptAbove,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

export type Editor = ReturnType<typeof useEditor>;

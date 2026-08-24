"use client";

import { useCallback, useEffect, useState } from "react";

import { videosDestroy, videosList, type VideoList } from "@/lib/api";
import { isActive } from "@/lib/videos";

const POLL_MS = 3000;

/**
 * The user's videos, kept live while any of them is still working.
 *
 * Lives here rather than inside the queue because the preview panel needs the
 * same rows — a second polling loop for the selected video would double the
 * request rate and still drift out of step with the list.
 *
 * ponytail: refetches the whole first page each tick; switch to per-uuid
 * videosStatusRetrieve if the list ever grows past a page. Note that /status
 * omits file_url, so the preview would need its own source for that.
 */
export function useVideos() {
  const [videos, setVideos] = useState<VideoList[] | null>(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((r) => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Poll only while something is still working; stop once nothing is.
    async function tick() {
      const { data, response } = await videosList();
      if (cancelled) return;

      if (data && response?.ok) {
        setVideos(data.results);
        if (data.results.some(isActive)) timer = setTimeout(tick, POLL_MS);
      } else {
        setVideos((current) => current ?? []);
        // Unreachable API: back off rather than hammering it.
        if (!response) timer = setTimeout(tick, POLL_MS * 4);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reload]);

  const remove = useCallback(async (uuid: string) => {
    setVideos((current) => current?.filter((v) => v.uuid !== uuid) ?? null);
    const { response } = await videosDestroy({ path: { uuid } });
    // 404 means it is already gone, so the optimistic removal was right.
    // Anything else and the row still exists — resync rather than lie about it.
    if (!response?.ok && response?.status !== 404) setReload((r) => r + 1);
  }, []);

  return { videos, refresh, remove };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { adsDestroy, adsList, tonesList, type Ad } from "@/lib/api";

const POLL_MS = 5000;

/**
 * The ad catalog, kept live while any ad is still waiting on its embedding.
 *
 * `embed_ad` runs in a worker after create (the model is 90 MB), so a fresh ad
 * lands with `is_embedded: false` and flips a few seconds later. Polling stops
 * the moment every ad is embedded — same shape as `useVideos`.
 */
export function useAds() {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [tones, setTones] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [pages, setPages] = useState(1);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((r) => r + 1), []);
  const loadMore = useCallback(() => setPages((p) => p + 1), []);

  // Tied to the same signal as the list: `ToneRelatedField` get_or_creates, so
  // saving an ad with a tone nobody has used before adds a row to /tones.
  useEffect(() => {
    let cancelled = false;
    void tonesList().then(({ data }) => {
      if (!cancelled && data) setTones(data.map((tone) => tone.name));
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      // Every page loaded so far, so a poll never shrinks the grid back to one
      // page. PAGE_SIZE is 50, so this is a single request in practice.
      const requests = Array.from({ length: pages }, (_, i) =>
        adsList({ query: { page: i + 1 } }),
      );
      const settled = await Promise.all(requests);
      if (cancelled) return;

      const first = settled[0];
      if (first.data && first.response?.ok) {
        const rows = settled.flatMap((r) => r.data?.results ?? []);
        setAds(rows);
        setCount(first.data.count);
        if (rows.some((ad) => !ad.is_embedded)) timer = setTimeout(tick, POLL_MS);
      } else {
        setAds((current) => current ?? []);
        // Unreachable API: back off rather than hammering it.
        if (!first.response) timer = setTimeout(tick, POLL_MS * 4);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reload, pages]);

  const remove = useCallback(async (id: number) => {
    setAds((current) => current?.filter((ad) => ad.id !== id) ?? null);
    setCount((c) => Math.max(0, c - 1));
    const { response } = await adsDestroy({ path: { id } });
    // 404 means it is already gone, so the optimistic removal was right.
    // Anything else and the row still exists — resync rather than lie about it.
    if (!response?.ok && response?.status !== 404) setReload((r) => r + 1);
  }, []);

  return { ads, tones, count, refresh, remove, loadMore };
}

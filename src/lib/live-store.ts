import { create } from "zustand";
import type { Market } from "@/lib/types";
import { listLiveMarkets } from "@/lib/server/live";
import { impliedFromOdds } from "@/lib/protocol/odds";

export type LiveState = {
  markets: Market[];
  bySlug: Record<string, Market>;
  byId: Record<string, Market>;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  at: number;
  chainId: number | null;
  refresh: () => Promise<void>;
  patchOdds: (conditionId: string, odds: Record<string, number>, state?: string) => void;
};

function indexOf(markets: Market[]) {
  const bySlug: Record<string, Market> = {};
  const byId: Record<string, Market> = {};
  for (const m of markets) {
    bySlug[m.slug] = m;
    byId[m.id] = m;
  }
  return { bySlug, byId };
}

export const useLiveStore = create<LiveState>((set, get) => ({
  markets: [],
  bySlug: {},
  byId: {},
  status: "idle",
  error: null,
  at: 0,
  chainId: null,
  refresh: async () => {
    if (get().status === "loading" && Date.now() - get().at < 30_000) return;
    set({ status: get().markets.length ? "ready" : "loading" });
    try {
      const res = await listLiveMarkets();
      const { bySlug, byId } = indexOf(res.markets);
      set({
        markets: res.markets,
        bySlug,
        byId,
        status: res.ok || res.markets.length ? "ready" : "error",
        error: res.error,
        at: res.at,
        chainId: res.chainId,
      });
    } catch (err) {
      set({
        status: get().markets.length ? "ready" : "error",
        error: err instanceof Error ? err.message : "Live book unavailable",
      });
    }
  },
  patchOdds: (conditionId, odds, state) => {
    const markets = get().markets.map((m) => {
      if (m.conditionId !== conditionId) return m;
      const seed = impliedFromOdds(odds);
      return {
        ...m,
        odds: { ...m.odds, ...odds },
        seed: Object.keys(seed).length ? seed : m.seed,
        status: state === "Stopped" ? "paused" : state === "Active" ? (m.status === "live" ? "live" : "open") : m.status,
      };
    });
    set({ markets, ...indexOf(markets) });
  },
}));

export function resolveMarket(slug: string, catalogBySlug: Record<string, Market>): Market | undefined {
  return useLiveStore.getState().bySlug[slug] ?? catalogBySlug[slug];
}

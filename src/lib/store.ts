import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyBuy,
  applySell,
  initPool,
  lmsrPrices,
  quoteBuy,
  quoteSell,
  sharesForSpend,
  type Pool,
} from "./amm";
import { generateHistory } from "./history";
import { MARKETS } from "./markets";
import type { Position, PricePoint, Trade } from "./types";
import type { Profile, LimitDTO, ParlayDTO } from "./server/desk";

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePools(): Record<string, Pool> {
  const pools: Record<string, Pool> = {};
  for (const m of MARKETS) {
    pools[m.id] = initPool(m.seed, Math.max(80, m.liquidity / 25), m.seedVolume);
  }
  return pools;
}

function replay(pools: Record<string, Pool>, trades: Trade[]): Record<string, Pool> {
  const next: Record<string, Pool> = {};
  for (const [id, p] of Object.entries(pools)) next[id] = { ...p, q: { ...p.q } };
  for (const t of trades) {
    const pool = next[t.marketId];
    if (!pool || pool.q[t.outcomeId] === undefined) continue;
    const applied =
      t.action === "buy"
        ? applyBuy(pool, t.outcomeId, t.shares)
        : applySell(pool, t.outcomeId, t.shares);
    next[t.marketId] = t.action === "buy" ? applied.pool : (applied as { pool: Pool }).pool;
  }
  return next;
}

function seedHistories(): Record<string, PricePoint[]> {
  const h: Record<string, PricePoint[]> = {};
  for (const m of MARKETS) {
    const primary = m.outcomes[0].id;
    h[m.id] = generateHistory(m.slug, m.seed[primary] ?? 0.5);
  }
  return h;
}

export type MarketStore = {
  cash: number;
  positions: Position[];
  trades: Trade[];
  watchlist: string[];
  pools: Record<string, Pool>;
  histories: Record<string, PricePoint[]>;
  hydrated: boolean;
  linked: boolean;
  handle: string | null;
  xp: number;
  deposited: number;
  orders: LimitDTO[];
  parlays: ParlayDTO[];
  hydrate: () => void;
  tick: () => void;
  buy: (marketId: string, outcomeId: string, usd: number) => { ok: true } | { ok: false; error: string };
  sell: (
    marketId: string,
    outcomeId: string,
    shares: number,
  ) => { ok: true } | { ok: false; error: string };
  toggleWatch: (marketId: string) => void;
  deposit: (usd: number) => void;
  reset: () => void;
  applySnapshot: (s: {
    profile: Profile;
    pools: Record<string, Pool>;
    positions: Position[];
    watchlist: string[];
    fills: { id: number; marketId: string; outcomeId: string; action: "buy" | "sell"; shares: number; cost: number; price: number; at: string }[];
    orders?: LimitDTO[];
    parlays?: ParlayDTO[];
  }) => void;
  patchAfterTrade: (s: { pool: Pool; marketId: string; profile: Profile; positions: Position[] }) => void;
  patchProfile: (profile: Profile) => void;
  unlink: () => void;
};

const STARTING_CASH = 10_000;

export const useMarketStore = create<MarketStore>()(
  persist(
    (set, get) => ({
      cash: STARTING_CASH,
      positions: [],
      trades: [],
      watchlist: [],
      pools: makePools(),
      histories: seedHistories(),
      hydrated: false,
      linked: false,
      handle: null,
      xp: 0,
      deposited: STARTING_CASH,
      orders: [],
      parlays: [],
      hydrate: () => {
        if (get().linked) {
          set({ hydrated: true });
          return;
        }
        const base = makePools();
        const pools = replay(base, get().trades);
        set({ pools, histories: seedHistories(), hydrated: true });
      },
      tick: () => {
        if (get().linked) return;
        const rand = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
        const pools = { ...get().pools };
        const histories = { ...get().histories };
        for (const m of MARKETS) {
          if (rand() > 0.42) continue;
          const pool = pools[m.id];
          if (!pool) continue;
          const keys = Object.keys(pool.q);
          const outcomeId = keys[Math.floor(rand() * keys.length)];
          const delta = (rand() - 0.48) * (pool.b * 0.012);
          const q = { ...pool.q, [outcomeId]: pool.q[outcomeId] + delta };
          const volume = pool.volume + Math.abs(delta) * 0.4;
          pools[m.id] = { ...pool, q, volume };
          const prices = lmsrPrices(q, pool.b);
          const primary = m.outcomes[0].id;
          const series = histories[m.id] ? [...histories[m.id]] : [];
          series.push({ t: Date.now(), p: prices[primary] });
          if (series.length > 120) series.shift();
          histories[m.id] = series;
        }
        set({ pools, histories });
      },
      buy: (marketId, outcomeId, usd) => {
        const pool = get().pools[marketId];
        if (!pool) return { ok: false, error: "Market not found." };
        if (usd < 1) return { ok: false, error: "Minimum trade is $1." };
        if (usd > get().cash + 1e-9) return { ok: false, error: "Not enough cash." };
        const shares = sharesForSpend(pool, outcomeId, usd);
        if (shares <= 0) return { ok: false, error: "Size too small." };
        const { pool: nextPool, cost } = applyBuy(pool, outcomeId, shares);
        const spend = Math.min(cost, get().cash);
        const positions = [...get().positions];
        const idx = positions.findIndex((p) => p.marketId === marketId && p.outcomeId === outcomeId);
        if (idx >= 0) {
          positions[idx] = {
            ...positions[idx],
            shares: positions[idx].shares + shares,
            cost: positions[idx].cost + spend,
          };
        } else {
          positions.push({ marketId, outcomeId, shares, cost: spend });
        }
        const trade: Trade = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          marketId,
          outcomeId,
          action: "buy",
          shares,
          cost: spend,
          price: spend / shares,
          at: Date.now(),
        };
        const histories = { ...get().histories };
        const market = MARKETS.find((m) => m.id === marketId);
        if (market) {
          const prices = lmsrPrices(nextPool.q, nextPool.b);
          const series = histories[marketId] ? [...histories[marketId]] : [];
          series.push({ t: Date.now(), p: prices[market.outcomes[0].id] });
          histories[marketId] = series;
        }
        set({
          cash: get().cash - spend,
          pools: { ...get().pools, [marketId]: nextPool },
          positions,
          trades: [trade, ...get().trades].slice(0, 200),
          histories,
        });
        return { ok: true };
      },
      sell: (marketId, outcomeId, shares) => {
        const pool = get().pools[marketId];
        const pos = get().positions.find((p) => p.marketId === marketId && p.outcomeId === outcomeId);
        if (!pool || !pos) return { ok: false, error: "No position." };
        if (shares <= 0 || shares > pos.shares + 1e-9) return { ok: false, error: "Not enough shares." };
        const { pool: nextPool, proceeds } = applySell(pool, outcomeId, shares);
        const costCut = pos.cost * (shares / pos.shares);
        const positions = get()
          .positions.map((p) =>
            p.marketId === marketId && p.outcomeId === outcomeId
              ? { ...p, shares: p.shares - shares, cost: p.cost - costCut }
              : p,
          )
          .filter((p) => p.shares > 0.0001);
        const trade: Trade = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          marketId,
          outcomeId,
          action: "sell",
          shares,
          cost: proceeds,
          price: proceeds / shares,
          at: Date.now(),
        };
        set({
          cash: get().cash + proceeds,
          pools: { ...get().pools, [marketId]: nextPool },
          positions,
          trades: [trade, ...get().trades].slice(0, 200),
        });
        return { ok: true };
      },
      toggleWatch: (marketId) => {
        const watchlist = get().watchlist.includes(marketId)
          ? get().watchlist.filter((id) => id !== marketId)
          : [...get().watchlist, marketId];
        set({ watchlist });
      },
      deposit: (usd) => {
        const next = Math.min(50_000, get().cash + usd);
        set({ cash: next, deposited: get().deposited + usd });
      },
      reset: () => {
        set({
          cash: STARTING_CASH,
          positions: [],
          trades: [],
          watchlist: [],
          pools: makePools(),
          histories: seedHistories(),
          deposited: STARTING_CASH,
          orders: [],
          parlays: [],
          handle: null,
          xp: 0,
        });
      },
      unlink: () => {
        set({
          linked: false,
          handle: null,
          xp: 0,
          cash: STARTING_CASH,
          positions: [],
          trades: [],
          watchlist: [],
          pools: makePools(),
          histories: seedHistories(),
          deposited: STARTING_CASH,
          orders: [],
          parlays: [],
          hydrated: true,
        });
      },
      applySnapshot: (s) => {
        const trades: Trade[] = s.fills.map((f) => ({
          id: String(f.id),
          marketId: f.marketId,
          outcomeId: f.outcomeId,
          action: f.action,
          shares: f.shares,
          cost: f.cost,
          price: f.price,
          at: new Date(f.at).getTime(),
        }));
        set({
          linked: true,
          cash: s.profile.cash,
          deposited: s.profile.deposited,
          handle: s.profile.handle,
          xp: s.profile.xp,
          positions: s.positions,
          watchlist: s.watchlist,
          pools: { ...makePools(), ...s.pools },
          trades,
          orders: s.orders ?? [],
          parlays: s.parlays ?? [],
          hydrated: true,
        });
      },
      patchAfterTrade: ({ pool, marketId, profile, positions }) => {
        const histories = { ...get().histories };
        const market = MARKETS.find((m) => m.id === marketId);
        if (market) {
          const prices = lmsrPrices(pool.q, pool.b);
          const series = histories[marketId] ? [...histories[marketId]] : [];
          series.push({ t: Date.now(), p: prices[market.outcomes[0].id] });
          histories[marketId] = series;
        }
        set({
          cash: profile.cash,
          xp: profile.xp,
          deposited: profile.deposited,
          handle: profile.handle,
          positions,
          pools: { ...get().pools, [marketId]: pool },
          histories,
        });
      },
      patchProfile: (profile) => {
        set({
          cash: profile.cash,
          xp: profile.xp,
          deposited: profile.deposited,
          handle: profile.handle,
        });
      },
    }),
    {
      name: "ventran-paper-v2",
      partialize: (s) =>
        s.linked
          ? { linked: true }
          : {
              cash: s.cash,
              positions: s.positions,
              trades: s.trades,
              watchlist: s.watchlist,
            },
    },
  ),
);

export function positionValue(pos: Position, prices: Record<string, number>): number {
  return pos.shares * (prices[pos.outcomeId] ?? 0);
}

export { quoteBuy, quoteSell, sharesForSpend };

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PERPS, PERP_ROUND_MS, roundStart } from "./catalog";
import { useMarketStore } from "./store";

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function roundWinner(id: string, start: number): "up" | "down" {
  return mulberry32(hash(`${id}:${start}`))() > 0.5 ? "up" : "down";
}

export function upPrice(id: string, start: number, now: number, seed: number): number {
  const t = Math.min(1, Math.max(0, (now - start) / PERP_ROUND_MS));
  const dest = roundWinner(id, start) === "up" ? 0.78 : 0.22;
  const rand = mulberry32(hash(`${id}:${start}:n`) + Math.floor(now / 4000))();
  const wobble = (rand - 0.5) * 0.04;
  const p = seed + (dest - seed) * (0.15 + 0.85 * t) + wobble;
  return Math.min(0.92, Math.max(0.08, p));
}

export type PerpPos = {
  id: string;
  perpId: string;
  roundStart: number;
  side: "up" | "down";
  stake: number;
  price: number;
  settled: boolean;
  won?: boolean;
};

type PerpStore = {
  positions: PerpPos[];
  lastClaim: number;
  buy: (perpId: string, side: "up" | "down", stake: number, now: number) => { ok: true } | { ok: false; error: string };
  settle: (now: number) => void;
  claimWeekly: (now: number) => { ok: true; amount: number } | { ok: false; error: string };
};

export const usePerpStore = create<PerpStore>()(
  persist(
    (set, get) => ({
      positions: [],
      lastClaim: 0,
      buy: (perpId, side, stake, now) => {
        if (stake < 1) return { ok: false, error: "Minimum is $1." };
        const cash = useMarketStore.getState().cash;
        if (stake > cash + 1e-9) return { ok: false, error: "Not enough cash." };
        const meta = PERPS.find((p) => p.id === perpId);
        if (!meta) return { ok: false, error: "Unknown perp." };
        const start = roundStart(now);
        const price = side === "up" ? upPrice(perpId, start, now, meta.seed) : 1 - upPrice(perpId, start, now, meta.seed);
        useMarketStore.setState({ cash: cash - stake });
        const pos: PerpPos = {
          id: `${now}-${Math.random().toString(16).slice(2)}`,
          perpId,
          roundStart: start,
          side,
          stake,
          price,
          settled: false,
        };
        set({ positions: [pos, ...get().positions].slice(0, 80) });
        return { ok: true };
      },
      settle: (now) => {
        const start = roundStart(now);
        let credit = 0;
        const positions = get().positions.map((p) => {
          if (p.settled || p.roundStart >= start) return p;
          const winner = roundWinner(p.perpId, p.roundStart);
          const won = p.side === winner;
          if (won) credit += p.stake / p.price;
          return { ...p, settled: true, won };
        });
        if (credit > 0) {
          useMarketStore.setState({ cash: useMarketStore.getState().cash + credit });
        }
        set({ positions });
      },
      claimWeekly: (now) => {
        const week = 7 * 24 * 3600 * 1000;
        if (now - get().lastClaim < week) return { ok: false, error: "Already claimed this week." };
        useMarketStore.getState().deposit(500);
        set({ lastClaim: now });
        return { ok: true, amount: 500 };
      },
    }),
    { name: "ventran-perps-v1", partialize: (s) => ({ positions: s.positions, lastClaim: s.lastClaim }) },
  ),
);

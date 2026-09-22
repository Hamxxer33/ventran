import { lmsrPrices, type Pool } from "./amm";
import { PERPS } from "./catalog";
import { upPrice, type PerpPos } from "./perp-store";
import type { ParlayDTO } from "./server/desk";
import type { Position } from "./types";

export type DeskPnl = {
  equity: number;
  realized: number;
  unrealized: number;
  total: number;
  posValue: number;
};

export function computeDeskPnl(args: {
  cash: number;
  deposited: number;
  positions: Position[];
  pools: Record<string, Pool>;
  perpPositions: PerpPos[];
  parlays: ParlayDTO[];
  now: number;
}): DeskPnl {
  let posValue = 0;
  let posCost = 0;
  for (const p of args.positions) {
    const pool = args.pools[p.marketId];
    const prices = pool ? lmsrPrices(pool.q, pool.b) : {};
    posValue += p.shares * (prices[p.outcomeId] ?? 0);
    posCost += p.cost;
  }

  let perpValue = 0;
  let perpCost = 0;
  for (const p of args.perpPositions) {
    if (p.settled) continue;
    const meta = PERPS.find((x) => x.id === p.perpId);
    if (!meta || p.price <= 0) continue;
    const up = upPrice(p.perpId, p.roundStart, args.now, meta.seed);
    const px = p.side === "up" ? up : 1 - up;
    perpCost += p.stake;
    perpValue += (p.stake / p.price) * px;
  }

  let parlayLocked = 0;
  for (const p of args.parlays) {
    if (p.status === "open") parlayLocked += p.stake;
  }

  const unrealized = posValue - posCost + (perpValue - perpCost);
  const equity = args.cash + posValue + perpValue + parlayLocked;
  const total = equity - args.deposited;
  const realized = total - unrealized;
  return { equity, realized, unrealized, total, posValue };
}

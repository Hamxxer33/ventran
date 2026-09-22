export type Pool = {
  q: Record<string, number>;
  b: number;
  volume: number;
};

function logSumExp(values: number[]): number {
  const m = Math.max(...values);
  let sum = 0;
  for (const v of values) sum += Math.exp(v - m);
  return m + Math.log(sum);
}

export function lmsrCost(q: Record<string, number>, b: number): number {
  return b * logSumExp(Object.values(q).map((qi) => qi / b));
}

export function lmsrPrices(q: Record<string, number>, b: number): Record<string, number> {
  const keys = Object.keys(q);
  const scaled = keys.map((k) => q[k] / b);
  const m = Math.max(...scaled);
  const exps: Record<string, number> = {};
  let sum = 0;
  for (let i = 0; i < keys.length; i++) {
    const e = Math.exp(scaled[i] - m);
    exps[keys[i]] = e;
    sum += e;
  }
  const prices: Record<string, number> = {};
  for (const k of keys) prices[k] = exps[k] / sum;
  return prices;
}

export function initPool(seed: Record<string, number>, b: number, volume: number): Pool {
  const q: Record<string, number> = {};
  for (const [id, p] of Object.entries(seed)) {
    const clamped = Math.min(0.97, Math.max(0.03, p));
    q[id] = b * Math.log(clamped);
  }
  return { q, b, volume };
}

export function quoteBuy(pool: Pool, outcomeId: string, shares: number): number {
  if (shares <= 0) return 0;
  const next = { ...pool.q, [outcomeId]: pool.q[outcomeId] + shares };
  return lmsrCost(next, pool.b) - lmsrCost(pool.q, pool.b);
}

export function quoteSell(pool: Pool, outcomeId: string, shares: number): number {
  if (shares <= 0) return 0;
  const held = pool.q[outcomeId] ?? 0;
  const nextQ = Math.max(held - shares, held - Math.abs(held) - shares);
  const next = { ...pool.q, [outcomeId]: nextQ };
  return lmsrCost(pool.q, pool.b) - lmsrCost(next, pool.b);
}

export function sharesForSpend(pool: Pool, outcomeId: string, usd: number): number {
  if (usd <= 0) return 0;
  let lo = 0;
  let hi = Math.max(usd * 50, 1);
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2;
    if (quoteBuy(pool, outcomeId, mid) < usd) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function applyBuy(pool: Pool, outcomeId: string, shares: number): { pool: Pool; cost: number } {
  const cost = quoteBuy(pool, outcomeId, shares);
  return {
    cost,
    pool: {
      ...pool,
      q: { ...pool.q, [outcomeId]: pool.q[outcomeId] + shares },
      volume: pool.volume + cost,
    },
  };
}

export function applySell(pool: Pool, outcomeId: string, shares: number): { pool: Pool; proceeds: number } {
  const proceeds = quoteSell(pool, outcomeId, shares);
  return {
    proceeds,
    pool: {
      ...pool,
      q: { ...pool.q, [outcomeId]: pool.q[outcomeId] - shares },
      volume: pool.volume + proceeds,
    },
  };
}

export function depthLevels(
  pool: Pool,
  outcomeId: string,
  side: "buy" | "sell",
  steps = 8,
): { price: number; shares: number; total: number }[] {
  const chunk = Math.max(4, pool.b / 40);
  const levels: { price: number; shares: number; total: number }[] = [];
  let cursor: Pool = pool;
  let total = 0;
  for (let i = 0; i < steps; i++) {
    if (side === "buy") {
      const { pool: next, cost } = applyBuy(cursor, outcomeId, chunk);
      total += cost;
      levels.push({ price: cost / chunk, shares: chunk, total });
      cursor = next;
    } else {
      const { pool: next, proceeds } = applySell(cursor, outcomeId, chunk);
      total += proceeds;
      levels.push({ price: proceeds / chunk, shares: chunk, total });
      cursor = next;
    }
  }
  return levels;
}

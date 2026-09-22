/** Convert decimal odds to implied probabilities that sum to 1. */
export function impliedFromOdds(odds: Record<string, number>): Record<string, number> {
  const weights: Record<string, number> = {};
  let sum = 0;
  for (const [id, o] of Object.entries(odds)) {
    if (!(o > 1) || !Number.isFinite(o)) continue;
    const w = 1 / o;
    weights[id] = w;
    sum += w;
  }
  if (sum <= 0) return {};
  const out: Record<string, number> = {};
  for (const [id, w] of Object.entries(weights)) out[id] = w / sum;
  return out;
}

export function payoutFromStake(stake: number, decimalOdds: number): number {
  if (!(stake > 0) || !(decimalOdds > 1)) return 0;
  return stake * decimalOdds;
}

export function profitFromStake(stake: number, decimalOdds: number): number {
  return Math.max(0, payoutFromStake(stake, decimalOdds) - stake);
}

export function applyFeeBps(amount: number, bps: number): { net: number; fee: number } {
  if (!(amount > 0) || !(bps > 0)) return { net: amount, fee: 0 };
  const fee = Math.round(((amount * bps) / 10_000) * 1e6) / 1e6;
  return { net: amount - fee, fee };
}

/** Stake fee is only collected when both bps and a destination address are set. */
export function collectibleFee(
  amount: number,
  bps: number,
  collectTo?: string,
): { net: number; fee: number; collectTo?: string } {
  if (!(amount > 0) || !(bps > 0) || !collectTo) return { net: amount, fee: 0 };
  const { net, fee } = applyFeeBps(amount, bps);
  if (!(fee > 0) || !(net > 0)) return { net: amount, fee: 0 };
  return { net, fee, collectTo };
}

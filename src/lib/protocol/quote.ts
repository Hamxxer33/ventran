export type QuoteGuardInput = {
  amount: number;
  venue?: string;
  status?: string;
  conditionState?: string;
  outcomeHidden?: boolean;
  outcomeState?: string;
  odds: number;
  minBet?: number;
  maxBet?: number;
};

export function quoteGuard(input: QuoteGuardInput): { ok: true } | { ok: false; error: string } {
  if (!(input.amount > 0)) return { ok: false, error: "Enter an amount." };
  if (input.venue !== "azuro") return { ok: false, error: "Market is not on the live book." };
  if (input.status === "paused") return { ok: false, error: "This market is paused." };
  if (input.status === "resolved" || input.status === "canceled") {
    return { ok: false, error: "This market is closed." };
  }
  if (input.conditionState && input.conditionState !== "Active") {
    return { ok: false, error: "Odds are stale. Refresh and try again." };
  }
  if (input.outcomeHidden || (input.outcomeState && input.outcomeState !== "Active")) {
    return { ok: false, error: "That outcome is not available." };
  }
  if (!(input.odds > 1)) return { ok: false, error: "No odds for that outcome." };
  if (input.minBet != null && input.amount < input.minBet) {
    return { ok: false, error: `Minimum bet is ${input.minBet}.` };
  }
  if (input.maxBet != null && input.amount > input.maxBet) {
    return { ok: false, error: `Max bet is ${input.maxBet}.` };
  }
  return { ok: true };
}

export const QUOTE_STALE_MS = 25_000;

export function quoteIsFresh(quotedAt: number, now = Date.now()): boolean {
  return Number.isFinite(quotedAt) && now - quotedAt >= 0 && now - quotedAt <= QUOTE_STALE_MS;
}

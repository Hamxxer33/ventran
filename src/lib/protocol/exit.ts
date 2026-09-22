export type ExitBet = {
  state: string;
  result: string | null;
  isCashedOut: boolean;
  isRedeemed: boolean;
  tokenId: string | null;
  graphBetId: string | null;
  lpAddress: string | null;
};

export function canCashoutBet(b: Pick<ExitBet, "state" | "result" | "isCashedOut" | "graphBetId">): boolean {
  if (b.isCashedOut) return false;
  if (b.result) return false;
  if (b.state !== "Accepted") return false;
  return Boolean(b.graphBetId);
}

export function canClaimBet(b: Pick<ExitBet, "result" | "isRedeemed" | "tokenId" | "lpAddress">): boolean {
  if (b.isRedeemed) return false;
  if (b.result !== "Won" && b.result !== "Canceled") return false;
  return Boolean(b.tokenId) && Boolean(b.lpAddress);
}

/** Azuro APIs mix decimal token amounts and raw integer units. */
export function parseTokenAmount(raw: string, decimals: number): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  if (s.includes(".")) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    const asInt = BigInt(s);
    const den = 10 ** decimals;
    return Number(asInt) / den;
  } catch {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
}

/** getCashoutTypedData parseUnits()s decimal strings at 12dp; raw ints pass through. */
export function cashoutOddsForSign(raw: string): string | bigint {
  const s = String(raw ?? "").trim();
  if (!s) return "1";
  if (s.includes(".")) return s;
  try {
    return BigInt(s);
  } catch {
    return s;
  }
}

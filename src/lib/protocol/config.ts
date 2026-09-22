import { chainsData, type ChainId } from "@azuro-org/toolkit";
import type { Address } from "viem";

function readEnv(key: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[key]?.trim()
      : undefined;
  return fromProcess || fromVite || undefined;
}

function numEnv(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Azuro V3 has no live book on Arbitrum One; Polygon USDT is the live venue. */
export const DEFAULT_AZURO_CHAIN_ID = 137 as const satisfies ChainId;

export const ARBITRUM_CHAIN_ID = 42161;
export const ARBITRUM_USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export function azuroChainId(): ChainId {
  const id = numEnv("VITE_AZURO_CHAIN_ID", DEFAULT_AZURO_CHAIN_ID) as ChainId;
  return id in chainsData ? id : DEFAULT_AZURO_CHAIN_ID;
}

export function azuroChain() {
  return chainsData[azuroChainId()];
}

export function platformFeeBps(): number {
  const bps = Math.round(numEnv("VITE_PLATFORM_FEE_BPS", 0));
  return Math.min(500, Math.max(0, bps));
}

export function platformFeeAddress(): Address | undefined {
  const v = readEnv("VITE_PLATFORM_FEE_ADDRESS") as Address | undefined;
  return v && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : undefined;
}

export function azuroAffiliate(): Address | undefined {
  const v = readEnv("VITE_AZURO_AFFILIATE") as Address | undefined;
  return v && /^0x[a-fA-F0-9]{40}$/.test(v) ? v : undefined;
}

export function polygonRpc(): string {
  return readEnv("VITE_POLYGON_RPC") || "https://polygon-bor-rpc.publicnode.com";
}

export function arbitrumRpc(): string {
  return readEnv("VITE_ARBITRUM_RPC") || "https://arb1.arbitrum.io/rpc";
}

export const ATTENTION =
  "By signing this I agree to place a bet on Azuro via Ventran";

export const CASHOUT_ATTENTION = "By signing this I agree to cash out on Azuro via Ventran";

export const FEED_TTL_MS = 20_000;
export const MAX_GAMES_PREMATCH = 40;
export const MAX_GAMES_LIVE = 20;
export const MAX_CONDITIONS_PER_GAME = 6;

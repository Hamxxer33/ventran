import type { PricePoint } from "./types";

export const CLOCK_ORIGIN = Date.UTC(2026, 8, 21, 16, 0, 0);

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateHistory(slug: string, endPrice: number, points = 72): PricePoint[] {
  const rand = mulberry32(hashSlug(slug));
  const now = CLOCK_ORIGIN;
  const span = 1000 * 60 * 60 * 24 * 28;
  let p = Math.min(0.85, Math.max(0.15, endPrice + (rand() - 0.5) * 0.28));
  const out: PricePoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = now - span + (span * i) / (points - 1);
    const pull = (endPrice - p) * (0.08 + rand() * 0.06);
    p = Math.min(0.97, Math.max(0.03, p + pull + (rand() - 0.5) * 0.045));
    if (i === points - 1) p = endPrice;
    out.push({ t, p });
  }
  return out;
}

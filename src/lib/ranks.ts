export type Rank = { name: string; level: number; next: number | null; floor: number };

const FLOORS: { name: string; xp: number }[] = [
  { name: "Observer", xp: 0 },
  { name: "Scalper", xp: 100 },
  { name: "Trader", xp: 400 },
  { name: "Desk", xp: 1000 },
  { name: "Oracle", xp: 2500 },
];

export function rankForXp(xp: number): Rank {
  let i = 0;
  while (i < FLOORS.length - 1 && xp >= FLOORS[i + 1].xp) i += 1;
  const next = i < FLOORS.length - 1 ? FLOORS[i + 1].xp : null;
  return { name: FLOORS[i].name, level: i + 1, next, floor: FLOORS[i].xp };
}

export function rankProgress(xp: number): number {
  const r = rankForXp(xp);
  if (!r.next) return 1;
  return Math.min(1, Math.max(0, (xp - r.floor) / (r.next - r.floor)));
}

export function badgesFor(stats: {
  fills: number;
  volume: number;
  followers: number;
  parlays: number;
  limitsFilled: number;
}): string[] {
  const out: string[] = [];
  if (stats.fills >= 1) out.push("First fill");
  if (stats.fills >= 10) out.push("Active desk");
  if (stats.volume >= 1000) out.push("Sized");
  if (stats.followers >= 1) out.push("Watched");
  if (stats.parlays >= 1) out.push("Combiner");
  if (stats.limitsFilled >= 1) out.push("Patient");
  return out;
}

export function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

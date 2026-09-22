import type { ConditionDetailedData, GameData, OutcomeData } from "@azuro-org/toolkit";
import type { Category, Market, MarketStatus, Outcome } from "@/lib/types";
import { impliedFromOdds } from "./odds.ts";

const MAX_CONDITIONS_PER_GAME = 6;

const SPORT_TOPIC: Record<string, string[]> = {
  "american-football": ["sports", "nfl"],
  football: ["sports"],
  basketball: ["sports"],
  baseball: ["sports"],
  tennis: ["sports"],
  "ice-hockey": ["sports"],
  mma: ["sports"],
  boxing: ["sports"],
  "formula-1": ["sports"],
  volleyball: ["sports"],
  handball: ["sports"],
  "rugby-league": ["sports"],
  "rugby-union": ["sports"],
  cs2: ["sports"],
  "dota-2": ["sports"],
  lol: ["sports"],
  "table-tennis": ["sports"],
};

function encodeImg(url: string | null | undefined): string {
  if (!url) return "/markets/stadium.jpg";
  try {
    const u = new URL(url);
    u.pathname = u.pathname
      .split("/")
      .map((p) => encodeURIComponent(decodeURIComponent(p)))
      .join("/");
    return u.toString();
  } catch {
    return "/markets/stadium.jpg";
  }
}

function shortLabel(label: string): string {
  const t = label.trim();
  if (t.length <= 14) return t;
  const cut = t.replace(/\s*\([^)]*\)\s*$/, "");
  return cut.length <= 14 ? cut : `${cut.slice(0, 12)}…`;
}

function visibleOutcomes(cond: ConditionDetailedData): OutcomeData[] {
  return cond.outcomes.filter((o) => !o.hidden && o.state !== "Canceled");
}

export function isTradeableCondition(cond: ConditionDetailedData): boolean {
  if (cond.hidden) return false;
  if (cond.state !== "Active") return false;
  const outs = visibleOutcomes(cond).filter((o) => o.state === "Active" && Number(o.odds) > 1);
  return outs.length >= 2;
}

function marketStatus(gameState: string, condState: string): MarketStatus {
  if (condState === "Stopped") return "paused";
  if (gameState === "Live") return "live";
  if (gameState === "Finished") return "resolved";
  if (gameState === "Canceled") return "canceled";
  return "open";
}

export function conditionToMarket(game: GameData, cond: ConditionDetailedData, chainId: number): Market | null {
  const outs = visibleOutcomes(cond);
  if (outs.length < 2) return null;
  const odds: Record<string, number> = {};
  const outcomes: Outcome[] = [];
  for (const o of outs) {
    const dec = Number(o.odds);
    outcomes.push({ id: o.outcomeId, label: o.title, short: shortLabel(o.title) });
    if (dec > 1) odds[o.outcomeId] = dec;
  }
  const seed = impliedFromOdds(odds);
  if (Object.keys(seed).length < 2) return null;
  const image = encodeImg(game.participants[0]?.image);
  const startMs = Number(game.startsAt) * 1000;
  const endDate = Number.isFinite(startMs) ? new Date(startMs).toISOString() : new Date().toISOString();
  const sportSlug = game.sport.slug;
  const league = game.league.slug;
  const topics = [...(SPORT_TOPIC[sportSlug] ?? ["sports"]), sportSlug, league].filter(Boolean);
  const soon = startMs - Date.now() < 48 * 3_600_000 && startMs > Date.now();
  const won = cond.wonOutcomeIds?.[0] ?? null;
  return {
    id: `azuro-${cond.conditionId}`,
    slug: `${game.slug}-${cond.conditionId.slice(-10)}`,
    title: `${game.title}: ${cond.title}`,
    description: `${game.participants.map((p) => p.name).join(" vs ")}. ${game.league.name} · ${game.sport.name}.`,
    resolution: `Azuro protocol oracle (${game.sport.name}, ${game.league.name}). This app does not decide the winner.`,
    category: "sports" as Category,
    tags: ["sports", "trending"],
    image,
    endDate,
    featured: Number(game.turnover) > 50,
    isNew: soon,
    outcomes,
    seed,
    seedVolume: Number(game.turnover) || 0,
    liquidity: 0,
    comments: [],
    eventId: `azuro-game-${game.gameId}`,
    eventTitle: game.title,
    rowLabel: cond.title,
    topics,
    venue: "azuro",
    status: marketStatus(game.state, cond.state),
    gameId: game.gameId,
    conditionId: cond.conditionId,
    chainId,
    environment: "PolygonUSDT",
    odds,
    sportSlug,
    leagueName: game.league.name,
    resolutionSource: "Azuro protocol oracle",
    resolvedOutcomeId: won,
    participants: game.participants.map((p) => ({ name: p.name, image: p.image ?? null })),
  };
}

function conditionRank(cond: ConditionDetailedData): number {
  const cat = cond.category ?? "";
  if (cat === "winner" || cat === "result") return 0;
  if (cat === "yes_no") return 1;
  if (cat === "total") return 2;
  if (cat === "handicap") return 3;
  return 10 + Number(cond.sort || 0);
}

export function gameToMarkets(game: GameData, conditions: ConditionDetailedData[], chainId: number): Market[] {
  const picked = conditions
    .filter((c) => c.game?.gameId === game.gameId)
    .filter(isTradeableCondition)
    .sort((a, b) => conditionRank(a) - conditionRank(b) || Number(a.sort) - Number(b.sort))
    .slice(0, MAX_CONDITIONS_PER_GAME);
  const out: Market[] = [];
  for (const c of picked) {
    const m = conditionToMarket(game, c, chainId);
    if (m) out.push(m);
  }
  return out;
}

export function pickLivePrimary(markets: Market[]): Market | undefined {
  return markets.find((m) => m.status === "live" && (m.rowLabel ?? "").toLowerCase().includes("winner"))
    ?? markets.find((m) => m.status === "live");
}

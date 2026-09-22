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

const JUNK_RE =
  /\bodd\s*\/?\s*even\b|\bodd or even\b|\bcorners?\b|\b(yellow |red )?cards?\b|\bbookings?\b|\banytime scorer\b|\bplayer (props?|points|rebounds|assists)\b/i;
const PERIOD_RE =
  /\b((1st|2nd|3rd|4th|first|second|third|fourth)\s*(half|quarter|period|set)|half[-\s]?time|next\s+(goal|point|touchdown|try)|incl\.?\s*overtime)\b/i;
const WINNER_RE = /\b(winner|full time|full-time|match result|1x2|moneyline|to win|match winner)\b/i;

export function isJunkTitle(title: string): boolean {
  return JUNK_RE.test(title);
}

export function isPeriodTitle(title: string): boolean {
  return PERIOD_RE.test(title);
}

export function isWinnerTitle(title: string): boolean {
  return WINNER_RE.test(title);
}

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

function teamShort(name: string): string {
  const t = name.replace(/\s*\([^)]*\)/g, "").trim() || name.trim();
  if (t.length <= 14) return t;
  const filler = /^(fc|cf|sc|ac|cd|afc|the|de|da|do|del|la|el)$/i;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) {
    const last = parts[parts.length - 1] ?? t;
    return last.length <= 14 ? last : `${last.slice(0, 12)}…`;
  }
  const core = parts.filter((p) => !filler.test(p));
  const head = core[0];
  if (head && head.length >= 6 && head.length <= 14) return head;
  const last = core[core.length - 1] ?? parts[parts.length - 1] ?? t;
  return last.length <= 14 ? last : `${last.slice(0, 12)}…`;
}

function shortLabel(label: string, participants: { name: string }[] = []): string {
  const t = label.trim();
  const match = participants.find((p) => p.name === t);
  if (match) return teamShort(match.name);
  const stripped = t.replace(/\s*\([^)]*\)/g, "").trim();
  if (stripped.length > 0 && stripped.length <= 12) return stripped;
  if (t.length <= 12) return t;
  const cut = t.replace(/\s*\([^)]*\)\s*$/, "");
  return cut.length <= 12 ? cut : `${cut.slice(0, 10)}…`;
}

function outcomeOrder(title: string, participants: { name: string }[]): number {
  const i = participants.findIndex((p) => p.name === title);
  if (i === 0) return 0;
  if (i > 0) return 2;
  return 1;
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

export function lineLabel(title: string): string {
  const t = title.trim();
  if (isWinnerTitle(t) || /^(winner|result|full time result)$/i.test(t)) return "To win";
  if (/\bdraw no bet\b/i.test(t) && !isPeriodTitle(t)) return "Draw no bet";
  return t;
}

export function conditionToMarket(game: GameData, cond: ConditionDetailedData, chainId: number): Market | null {
  const outs = [...visibleOutcomes(cond)].sort(
    (a, b) => outcomeOrder(a.title, game.participants) - outcomeOrder(b.title, game.participants),
  );
  if (outs.length < 2) return null;
  const odds: Record<string, number> = {};
  const outcomes: Outcome[] = [];
  for (const o of outs) {
    const dec = Number(o.odds);
    outcomes.push({
      id: o.outcomeId,
      label: o.title,
      short: shortLabel(o.title, game.participants),
    });
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
    rowLabel: lineLabel(cond.title),
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

export function conditionRank(cond: ConditionDetailedData): number {
  const title = cond.title ?? "";
  const cat = cond.category ?? "";
  if (cat === "odd_even" || isJunkTitle(title) || cat === "players") return 80;
  if (cat === "correct_score") return 40;
  if (isPeriodTitle(title)) {
    if (cat === "winner" || cat === "result") return 25;
    return 45;
  }
  if (cat === "winner" || cat === "result" || isWinnerTitle(title)) return 0;
  if (/\bdraw no bet\b/i.test(title)) return 8;
  if (cat === "total" || cat === "total_3_way") return 2;
  if (cat === "handicap" || cat === "handicap_3_way") return 3;
  if (cat === "yes_no") return 6;
  return 12 + Number(cond.sort || 0);
}

export function gameToMarkets(game: GameData, conditions: ConditionDetailedData[], chainId: number): Market[] {
  const picked = conditions
    .filter((c) => c.game?.gameId === game.gameId)
    .filter(isTradeableCondition)
    .filter((c) => conditionRank(c) < 20)
    .sort((a, b) => conditionRank(a) - conditionRank(b) || Number(a.sort) - Number(b.sort))
    .slice(0, MAX_CONDITIONS_PER_GAME);
  const out: Market[] = [];
  for (const c of picked) {
    const m = conditionToMarket(game, c, chainId);
    if (m) out.push(m);
  }
  return out;
}

/** Lower is better. ≥ 50 means “don’t put this on a home live card”. */
export function homeCardRank(market: Market): number {
  const title = `${market.rowLabel ?? ""} ${market.title}`;
  if (isJunkTitle(title)) return 100;
  if (isPeriodTitle(title) && !isWinnerTitle(title)) return 60;
  if (isWinnerTitle(title) || market.rowLabel === "To win") return 0;
  if (/\bdraw no bet\b/i.test(title)) return 12;
  if (/\b(total|over|under|handicap|spread)\b/i.test(title)) return 15;
  return 30;
}

export function pickLivePrimary(markets: Market[]): Market | undefined {
  const scored = [...markets]
    .map((m) => ({
      m,
      r: homeCardRank(m),
      two: m.outcomes.length === 2 ? 0 : 1,
    }))
    .sort((a, b) => a.r - b.r || a.two - b.two || b.m.seedVolume - a.m.seedVolume);
  const best = scored[0];
  if (!best || best.r >= 50) return undefined;
  return best.m;
}

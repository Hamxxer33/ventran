import { lmsrPrices, type Pool } from "./amm";
import { MARKETS } from "./markets";
import { pickLivePrimary } from "@/lib/protocol/map";
import type { Market } from "./types";

export const TOPICS = [
  { id: "all", label: "All" },
  { id: "sports", label: "Sports" },
  { id: "ventra", label: "$VENTRA" },
  { id: "btc", label: "BTC" },
  { id: "politics", label: "Politics" },
  { id: "nfl", label: "NFL" },
  { id: "russia", label: "Russia" },
  { id: "fed", label: "Fed" },
  { id: "arbitrum", label: "Arbitrum" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export type EventGroup = {
  kind: "group";
  id: string;
  title: string;
  image: string;
  volume: number;
  markets: Market[];
};

export type FeedItem = { kind: "market"; market: Market } | EventGroup;

export function deskMarkets(): Market[] {
  return MARKETS.map((m) => ({ ...m, venue: m.venue ?? "desk" }));
}

export function mergeFeedMarkets(live: Market[]): Market[] {
  return [...live, ...deskMarkets()];
}

export function marketsForTopic(topic: string, rows: Market[] = MARKETS): Market[] {
  if (topic === "all" || topic === "trending") return rows;
  if (topic === "new") return rows.filter((m) => m.isNew);
  if (topic === "sports") return rows.filter((m) => m.category === "sports" || m.topics?.includes("sports"));
  return rows.filter(
    (m) =>
      m.topics?.includes(topic) ||
      m.category === topic ||
      m.tags.includes(topic as Market["tags"][number]),
  );
}

export function toFeed(rows: Market[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const m of rows) {
    if (!m.eventId) {
      out.push({ kind: "market", market: m });
      continue;
    }
    if (seen.has(m.eventId)) continue;
    seen.add(m.eventId);
    const members = rows.filter((x) => x.eventId === m.eventId);
    const volume = members.reduce((s, x) => s + x.seedVolume, 0);
    out.push({
      kind: "group",
      id: m.eventId,
      title: m.eventTitle ?? m.title,
      image: m.image,
      volume,
      markets: members,
    });
  }
  return out;
}

export type ComboDef = {
  id: string;
  title: string;
  kicker: string;
  legs: { marketId: string; outcomeId: string }[];
};

export const COMBOS: ComboDef[] = [
  {
    id: "arb-stack",
    title: "$VENTRA deploys and Arbitrum leads L2 TVL",
    kicker: "Arbitrum stack",
    legs: [
      { marketId: "ventra-launch", outcomeId: "yes" },
      { marketId: "arb-tvl", outcomeId: "yes" },
    ],
  },
  {
    id: "risk-on",
    title: "Bitcoin $150k and S&P 7,000 by year end",
    kicker: "Risk-on",
    legs: [
      { marketId: "btc-150k", outcomeId: "yes" },
      { marketId: "spx-eoy", outcomeId: "yes" },
    ],
  },
  {
    id: "midterms",
    title: "GOP House and Senate after 2026",
    kicker: "Midterms",
    legs: [
      { marketId: "house-2026", outcomeId: "yes" },
      { marketId: "senate-2026", outcomeId: "yes" },
    ],
  },
  {
    id: "launch-fdv",
    title: "$VENTRA live by October and first-week FDV $100m",
    kicker: "Launch",
    legs: [
      { marketId: "ventra-launch", outcomeId: "yes" },
      { marketId: "ventra-fdv", outcomeId: "yes" },
    ],
  },
];

export function comboQuote(
  combo: ComboDef,
  pools: Record<string, Pool>,
  extra: Market[] = [],
): { combined: number; legs: { market: Market; outcomeId: string; price: number }[] } {
  const catalog = [...extra, ...MARKETS];
  const legs = combo.legs.flatMap((leg) => {
    const market = catalog.find((m) => m.id === leg.marketId);
    if (!market) return [];
    const pool = pools[leg.marketId];
    const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
    return [{ market, outcomeId: leg.outcomeId, price: prices[leg.outcomeId] ?? 0 }];
  });
  const combined = legs.reduce((p, l) => p * l.price, 1);
  return { combined, legs };
}

export type BreakingItem = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  hoursAgo: number;
  marketSlug?: string;
};

export const BREAKING: BreakingItem[] = [
  {
    id: "whitelist",
    kicker: "$VENTRA",
    title: "Whitelist is live — allocation reads historical Arbitrum txs",
    body: "2.8B tokens earmarked for wallets that already used Arbitrum One. 180 $VENTRA per historical transaction, read from the chain.",
    hoursAgo: 2,
    marketSlug: "ventra-deploy-arbitrum-oct-2026",
  },
  {
    id: "clash",
    kicker: "Geopolitics",
    title: "Book opens on a NATO–Russia military clash this year",
    body: "Two dates, one event. October 31 is the near strike; December 31 is the year-end line. Paper only.",
    hoursAgo: 5,
    marketSlug: "nato-russia-clash-dec-2026",
  },
  {
    id: "btc5m",
    kicker: "Perps",
    title: "Five-minute Bitcoin up/down is live on the desk",
    body: "New round every five minutes. Up or Down, paper USDC, resolves when the clock hits zero.",
    hoursAgo: 1,
  },
  {
    id: "fed",
    kicker: "Fed",
    title: "October cut still the modal path on the book",
    body: "Dots vs. futures. The cut-by-October market is the cleanest rates expression on Ventran.",
    hoursAgo: 8,
    marketSlug: "fed-rate-cut-october-2026",
  },
];

export type PerpMeta = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  seed: number;
};

export const PERPS: PerpMeta[] = [
  { id: "btc-5m", symbol: "BTC", name: "Bitcoin", image: "/markets/bitcoin.jpg", seed: 0.47 },
  { id: "eth-5m", symbol: "ETH", name: "Ether", image: "/markets/orbit.jpg", seed: 0.51 },
  { id: "arb-5m", symbol: "ARB", name: "Arbitrum", image: "/markets/arbitrum.jpg", seed: 0.44 },
];

export const PERP_ROUND_MS = 5 * 60 * 1000;

export function roundStart(now: number, ms = PERP_ROUND_MS): number {
  return Math.floor(now / ms) * ms;
}

export type LiveFeedItem = { kind: "live"; perp: PerpMeta };
export type AzuroLiveItem = { kind: "azuro-live"; market: Market };
export type HomeFeedItem = FeedItem | LiveFeedItem | AzuroLiveItem;

export function composeHomeFeed(feed: FeedItem[], topic: string, live: Market[] = []): HomeFeedItem[] {
  const liveCards = homeSportsCards(live, topic);
  const used = new Set(
    liveCards.map((c) => c.market.eventId).filter((id): id is string => Boolean(id)),
  );
  const rest = feed.filter((item) => {
    if (item.kind === "group") return !used.has(item.id);
    if (item.kind === "market" && item.market.eventId) return !used.has(item.market.eventId);
    return true;
  });
  if (topic === "btc") {
    return [...PERPS.map((perp) => ({ kind: "live" as const, perp })), ...rest];
  }
  if (topic === "arbitrum") {
    const arb = PERPS.filter((p) => p.id === "arb-5m");
    return [...arb.map((perp) => ({ kind: "live" as const, perp })), ...rest];
  }
  if (topic !== "all") return [...liveCards, ...rest];
  const nato = rest.find((x) => x.kind === "group" && x.id === "nato-russia");
  const withoutNato = rest.filter((x) => !(x.kind === "group" && x.id === "nato-russia"));
  return nato ? [...liveCards, nato, ...withoutNato] : [...liveCards, ...withoutNato];
}

function homeSportsCards(live: Market[], topic: string): AzuroLiveItem[] {
  if (topic !== "all" && topic !== "sports" && topic !== "nfl") return [];
  const groups = new Map<string, Market[]>();
  for (const m of live) {
    if (m.venue !== "azuro") continue;
    if (topic === "nfl" && !(m.topics ?? []).includes("nfl") && m.sportSlug !== "american-football") continue;
    const key = m.eventId ?? m.id;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const livePrimary: Market[] = [];
  const upcoming: Market[] = [];
  for (const members of groups.values()) {
    const primary = pickLivePrimary(members);
    if (!primary) continue;
    if (primary.status === "live") livePrimary.push(primary);
    else upcoming.push(primary);
  }
  const cap = topic === "sports" || topic === "nfl" ? 6 : 2;
  return [...livePrimary, ...upcoming].slice(0, cap).map((market) => ({ kind: "azuro-live" as const, market }));
}

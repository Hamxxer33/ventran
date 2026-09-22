export const CATEGORIES = [
  "trending",
  "new",
  "crypto",
  "arbitrum",
  "politics",
  "sports",
  "finance",
  "geopolitics",
  "tech",
  "culture",
  "world",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Outcome = {
  id: string;
  label: string;
  short?: string;
};

export type Comment = {
  id: string;
  user: string;
  text: string;
  at: number;
  outcomeId?: string;
};

export type Venue = "desk" | "azuro";

export type MarketStatus = "open" | "live" | "paused" | "resolved" | "canceled";

export type Market = {
  id: string;
  slug: string;
  title: string;
  description: string;
  resolution: string;
  category: Category;
  tags: Category[];
  image: string;
  endDate: string;
  featured?: boolean;
  isNew?: boolean;
  outcomes: Outcome[];
  seed: Record<string, number>;
  seedVolume: number;
  liquidity: number;
  comments: Comment[];
  eventId?: string;
  eventTitle?: string;
  rowLabel?: string;
  topics?: string[];
  venue?: Venue;
  status?: MarketStatus;
  gameId?: string;
  conditionId?: string;
  chainId?: number;
  environment?: string;
  odds?: Record<string, number>;
  sportSlug?: string;
  leagueName?: string;
  resolutionSource?: string;
  resolvedOutcomeId?: string | null;
  participants?: { name: string; image?: string | null }[];
};

export type Position = {
  marketId: string;
  outcomeId: string;
  shares: number;
  cost: number;
};

export type Trade = {
  id: string;
  marketId: string;
  outcomeId: string;
  action: "buy" | "sell";
  shares: number;
  cost: number;
  price: number;
  at: number;
};

export type PricePoint = { t: number; p: number };

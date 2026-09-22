import { createServerFn } from "@tanstack/react-start";
import {
  calcMinOdds,
  chainsData,
  GameOrderBy,
  GameState,
  getBet,
  getBetCalculation,
  getBetFee,
  getBetsByBettor,
  getCalculatedCashout,
  getCashout,
  getConditionsByGameIds,
  getGamesByFilters,
  OrderDirection,
  searchGames,
  type ConditionDetailedData,
  type GameData,
} from "@azuro-org/toolkit";
import type { Address } from "viem";
import type { Market } from "@/lib/types";
import {
  azuroChainId,
  FEED_TTL_MS,
  MAX_GAMES_LIVE,
  MAX_GAMES_PREMATCH,
  platformFeeAddress,
  platformFeeBps,
} from "@/lib/protocol/config";
import { gameToMarkets } from "@/lib/protocol/map";
import { collectibleFee, payoutFromStake } from "@/lib/protocol/odds";
import { quoteGuard } from "@/lib/protocol/quote";
import { canCashoutBet, canClaimBet, parseTokenAmount } from "@/lib/protocol/exit";

type Cache = {
  at: number;
  markets: Market[];
  games: GameData[];
  conditions: Record<string, ConditionDetailedData>;
  error: string | null;
};

let cache: Cache | null = null;
const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function loadFeed(force = false): Promise<Cache> {
  if (!force && cache && Date.now() - cache.at < FEED_TTL_MS) return cache;
  return once("feed", async () => {
    const chainId = azuroChainId();
    try {
      const [prematch, live] = await Promise.all([
        withTimeout(
          getGamesByFilters({
            chainId,
            state: GameState.Prematch,
            orderBy: GameOrderBy.Turnover,
            orderDir: OrderDirection.Desc,
            page: 1,
            perPage: Math.max(10, MAX_GAMES_PREMATCH),
          }),
          12_000,
          "prematch feed",
        ),
        withTimeout(
          getGamesByFilters({
            chainId,
            state: GameState.Live,
            orderBy: GameOrderBy.Turnover,
            orderDir: OrderDirection.Desc,
            page: 1,
            perPage: Math.max(10, MAX_GAMES_LIVE),
          }),
          12_000,
          "live feed",
        ),
      ]);
      const seen = new Set<string>();
      const games: GameData[] = [];
      for (const g of [...live.games, ...prematch.games]) {
        if (seen.has(g.gameId)) continue;
        seen.add(g.gameId);
        games.push(g);
      }
      const ids = games.map((g) => g.gameId);
      const conds: ConditionDetailedData[] = [];
      for (let i = 0; i < ids.length; i += 25) {
        const chunk = ids.slice(i, i + 25);
        const rows = await withTimeout(
          getConditionsByGameIds({ chainId, gameIds: chunk, extended: true }),
          12_000,
          "conditions",
        );
        conds.push(...rows);
      }
      const byGame = new Map<string, ConditionDetailedData[]>();
      const byId: Record<string, ConditionDetailedData> = {};
      for (const c of conds) {
        byId[c.conditionId] = c;
        const gid = c.game?.gameId;
        if (!gid) continue;
        const list = byGame.get(gid) ?? [];
        list.push(c);
        byGame.set(gid, list);
      }
      const markets: Market[] = [];
      for (const g of games) {
        markets.push(...gameToMarkets(g, byGame.get(g.gameId) ?? [], chainId));
      }
      cache = { at: Date.now(), markets, games, conditions: byId, error: null };
      return cache;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Feed unavailable";
      if (cache) return { ...cache, error: message };
      cache = { at: Date.now(), markets: [], games: [], conditions: {}, error: message };
      return cache;
    }
  });
}

export const listLiveMarkets = createServerFn({ method: "GET" }).handler(async () => {
  const snap = await loadFeed();
  return {
    ok: !snap.error || snap.markets.length > 0,
    error: snap.error,
    at: snap.at,
    chainId: azuroChainId(),
    markets: snap.markets,
  };
});

export const getLiveMarket = createServerFn({ method: "GET" })
  .validator((d: { slug?: string; id?: string }) => d)
  .handler(async ({ data }) => {
    const snap = await loadFeed();
    const market =
      snap.markets.find((m) => m.slug === data.slug || m.id === data.id) ?? null;
    return { ok: Boolean(market), market, error: snap.error };
  });

export const searchLiveMarkets = createServerFn({ method: "GET" })
  .validator((q: string) => q)
  .handler(async ({ data: q }) => {
    const needle = q.trim();
    const snap = await loadFeed();
    const lower = needle.toLowerCase();
    const local = snap.markets.filter(
      (m) =>
        m.title.toLowerCase().includes(lower) ||
        (m.eventTitle ?? "").toLowerCase().includes(lower) ||
        (m.leagueName ?? "").toLowerCase().includes(lower),
    );
    if (needle.length < 3) {
      return { ok: true as const, markets: (needle ? local : snap.markets).slice(0, 8) };
    }
    const chainId = azuroChainId();
    try {
      const found = await searchGames({ chainId, query: needle, perPage: 10, page: 1 });
      const games = found.games ?? [];
      if (!games.length) return { ok: true as const, markets: local.slice(0, 12) };
      const conds = await getConditionsByGameIds({
        chainId,
        gameIds: games.map((g) => g.gameId),
        extended: true,
      });
      const markets: Market[] = [];
      for (const g of games) {
        markets.push(...gameToMarkets(g, conds.filter((c) => c.game?.gameId === g.gameId), chainId));
      }
      const merged = [...markets];
      for (const m of local) {
        if (!merged.some((x) => x.id === m.id)) merged.push(m);
      }
      return { ok: true as const, markets: merged.slice(0, 16) };
    } catch (err) {
      return { ok: false as const, markets: local.slice(0, 12), error: err instanceof Error ? err.message : "Search failed" };
    }
  });

export type LiveQuote =
  | {
      ok: true;
      minBet: number;
      maxBet: number;
      odds: number;
      payout: number;
      profit: number;
      relayerFee: number;
      relayerFeeRaw: string;
      tokenSymbol: string;
      decimals: number;
      slippage: number;
      minOdds: string;
      platformFee: number;
      platformFeeBps: number;
      feeTo?: string;
      stake: number;
      quotedAt: number;
      core: string;
      relayer: string;
      token: string;
      chainId: number;
      conditionId: string;
      outcomeId: string;
      status: string;
    }
  | { ok: false; error: string };

export const quoteLiveBet = createServerFn({ method: "POST" })
  .validator((d: { marketId: string; outcomeId: string; amount: number; account?: string }) => d)
  .handler(async ({ data }): Promise<LiveQuote> => {
    const amount = Number(data.amount);
    const snap = await loadFeed();
    const market = snap.markets.find((m) => m.id === data.marketId);
    const cond = market?.conditionId ? snap.conditions[market.conditionId] : undefined;
    const outcome = cond?.outcomes.find((o) => o.outcomeId === data.outcomeId);
    const guarded = quoteGuard({
      amount,
      venue: market?.venue,
      status: market?.status,
      conditionState: cond?.state,
      outcomeHidden: outcome?.hidden,
      outcomeState: outcome?.state,
      odds: Number(outcome?.odds ?? market?.odds?.[data.outcomeId] ?? 0),
    });
    if (!guarded.ok) return guarded;
    if (!market || !market.conditionId || !cond || !outcome) {
      return { ok: false, error: "Market is not on the live book." };
    }
    const chainId = azuroChainId();
    const odds = Number(outcome.odds);
    try {
      const account = data.account && /^0x[a-fA-F0-9]{40}$/.test(data.account) ? (data.account as Address) : undefined;
      const [calc, fee] = await Promise.all([
        getBetCalculation({
          chainId,
          account,
          selections: [{ conditionId: market.conditionId, outcomeId: data.outcomeId }],
        }),
        getBetFee(chainId),
      ]);
      const minBet = calc.minBet ?? 1;
      const limits = quoteGuard({
        amount,
        venue: "azuro",
        status: market.status,
        odds,
        minBet,
        maxBet: calc.maxBet,
      });
      if (!limits.ok) return { ok: false, error: limits.error.replace(".", ` ${fee.symbol}.`) };
      const collected = collectibleFee(amount, platformFeeBps(), platformFeeAddress());
      const minOdds = calcMinOdds({ odds, slippage: (fee.slippage || 0.05) * 100 });
      const chain = chainsData[chainId];
      const payout = payoutFromStake(collected.net, odds);
      return {
        ok: true,
        minBet,
        maxBet: calc.maxBet,
        odds,
        payout,
        profit: payout - collected.net,
        relayerFee: Number(fee.beautyRelayerFeeAmount) || 0,
        relayerFeeRaw: fee.relayerFeeAmount || "0",
        tokenSymbol: fee.symbol,
        decimals: fee.decimals,
        slippage: fee.slippage,
        minOdds,
        platformFee: collected.fee,
        platformFeeBps: collected.fee > 0 ? platformFeeBps() : 0,
        feeTo: collected.collectTo,
        stake: collected.net,
        quotedAt: Date.now(),
        core: chain.contracts.core.address,
        relayer: chain.contracts.relayer.address,
        token: chain.betToken.address,
        chainId,
        conditionId: market.conditionId,
        outcomeId: data.outcomeId,
        status: market.status ?? "open",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Quote failed." };
    }
  });

export type WalletBet = {
  id: string;
  graphBetId: string | null;
  state: string;
  result: string | null;
  amount: number;
  odds: number;
  payout: number | null;
  potentialPayout: number | null;
  txHash: string | null;
  tokenId: string | null;
  core: string;
  lpAddress: string;
  isRedeemed: boolean;
  isCashedOut: boolean;
  canCashout: boolean;
  canClaim: boolean;
  title: string;
  createdAt: string;
};

export const listWalletBets = createServerFn({ method: "GET" })
  .validator((wallet: string) => wallet)
  .handler(async ({ data: wallet }) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return { ok: false as const, error: "Bad wallet.", bets: [] as WalletBet[] };
    try {
      const [rows, snap] = await Promise.all([
        getBetsByBettor({
          chainId: azuroChainId(),
          bettor: wallet as Address,
          limit: 50,
        }),
        loadFeed(),
      ]);
      const bets: WalletBet[] = (rows ?? []).map((b) => {
        const graphBetId = b.meta?.id ?? null;
        const tokenId = b.meta?.betId ?? (b.betId != null ? String(b.betId) : null);
        const isRedeemed = Boolean(b.meta?.isRedeemed || b.redeemedAt);
        const isCashedOut = Boolean(b.meta?.isCashedOut);
        const cond = b.conditions[0];
        const market = cond
          ? snap.markets.find((m) => m.conditionId === cond.conditionId)
          : undefined;
        const outcome = market?.outcomes.find((o) => o.id === String(cond?.outcomeId ?? ""));
        const title = market
          ? `${market.eventTitle ?? market.title}${outcome ? ` · ${outcome.short ?? outcome.label}` : ""}`
          : cond
            ? `Azuro · ${cond.conditionId.slice(-8)}`
            : "Azuro bet";
        const dto: WalletBet = {
          id: b.id,
          graphBetId,
          state: b.state,
          result: b.result,
          amount: b.amount,
          odds: b.odds,
          payout: b.payout,
          potentialPayout: Number(b.meta?.potentialPayout ?? 0) || null,
          txHash: b.txHash,
          tokenId,
          core: b.core,
          lpAddress: b.lpAddress,
          isRedeemed,
          isCashedOut,
          canCashout: canCashoutBet({ state: b.state, result: b.result, isCashedOut, graphBetId }),
          canClaim: canClaimBet({ result: b.result, isRedeemed, tokenId, lpAddress: b.lpAddress }),
          title,
          createdAt: b.createdAt,
        };
        return dto;
      });
      return { ok: true as const, bets };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Could not load bets.", bets: [] as WalletBet[] };
    }
  });

export const pollLiveOrder = createServerFn({ method: "GET" })
  .validator((orderId: string) => orderId)
  .handler(async ({ data: orderId }) => {
    try {
      const bet = await getBet({ chainId: azuroChainId(), orderId });
      if (!bet) return { ok: false as const, error: "Order not found." };
      return { ok: true as const, bet };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Status failed." };
    }
  });

export type CashoutQuote =
  | {
      ok: true;
      calculationId: string;
      tokenId: string;
      cashoutOdds: string;
      cashoutAmount: string;
      amount: number;
      approveExpiredAt: number;
      expiredAt: number;
      isLive: boolean;
      chainId: number;
      tokenSymbol: string;
      decimals: number;
    }
  | { ok: false; error: string };

export const quoteCashout = createServerFn({ method: "POST" })
  .validator((d: { graphBetId: string; account: string }) => d)
  .handler(async ({ data }): Promise<CashoutQuote> => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(data.account)) return { ok: false, error: "Bad wallet." };
    if (!data.graphBetId) return { ok: false, error: "Missing bet." };
    const chainId = azuroChainId();
    try {
      const calc = await getCalculatedCashout({
        chainId,
        account: data.account as Address,
        graphBetId: data.graphBetId,
      });
      if (!calc) return { ok: false, error: "Cashout is not available for this bet." };
      if (calc.approveExpiredAt * 1000 < Date.now()) {
        return { ok: false, error: "Cashout quote expired. Try again." };
      }
      const token = chainsData[chainId].betToken;
      return {
        ok: true,
        calculationId: calc.calculationId,
        tokenId: calc.tokenId,
        cashoutOdds: calc.cashoutOdds,
        cashoutAmount: calc.cashoutAmount,
        amount: parseTokenAmount(calc.cashoutAmount, token.decimals),
        approveExpiredAt: calc.approveExpiredAt,
        expiredAt: calc.expiredAt,
        isLive: calc.isLive,
        chainId,
        tokenSymbol: token.symbol,
        decimals: token.decimals,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Cashout quote failed." };
    }
  });

export const pollCashout = createServerFn({ method: "GET" })
  .validator((orderId: string) => orderId)
  .handler(async ({ data: orderId }) => {
    try {
      const cashout = await getCashout({ chainId: azuroChainId(), orderId });
      if (!cashout) return { ok: false as const, error: "Cashout not found." };
      return { ok: true as const, cashout };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Status failed." };
    }
  });


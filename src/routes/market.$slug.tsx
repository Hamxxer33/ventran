import { Bookmark } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MarketCard } from "@/components/markets/market-card";
import { SplitBar } from "@/components/markets/probability";
import { MarketActivity } from "@/components/trade/activity";
import { MarketComments } from "@/components/trade/comments";
import { GrokBrief } from "@/components/trade/grok-brief";
import { OrderBook } from "@/components/trade/order-book";
import { PriceAlert } from "@/components/trade/price-alert";
import { ProbabilityChart } from "@/components/trade/probability-chart";
import { TradePanel } from "@/components/trade/trade-panel";
import { lmsrPrices } from "@/lib/amm";
import { daysUntil, formatPct, formatUsd, percentWidth } from "@/lib/format";
import { isBinary, MARKET_BY_SLUG, MARKETS } from "@/lib/markets";
import { useLiveStore } from "@/lib/live-store";
import { getLiveMarket } from "@/lib/server/live";
import { useMarketStore } from "@/lib/store";
import type { Market } from "@/lib/types";
import { watchMarket } from "@/lib/watch";
import { cn } from "@/lib/utils";

type Search = { side?: string };

export const Route = createFileRoute("/market/$slug")({
  component: MarketPage,
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = search.side;
    const side =
      typeof raw === "string" ? raw.replace(/^"|"$/g, "") : typeof raw === "number" ? String(raw) : undefined;
    return { side };
  },
});

function MarketPage() {
  const { slug } = Route.useParams();
  const { side } = Route.useSearch();
  const live = useLiveStore((s) => s.bySlug[slug]);
  const [fetched, setFetched] = useState<Market | null>(null);
  const [lookup, setLookup] = useState<"idle" | "loading" | "miss">("idle");
  const catalog = MARKET_BY_SLUG[slug];
  const market = live ?? fetched ?? catalog;
  const pool = useMarketStore((s) => (market ? s.pools[market.id] : undefined));
  const history = useMarketStore((s) => (market ? s.histories[market.id] : undefined));
  const watched = useMarketStore((s) => (market ? s.watchlist.includes(market.id) : false));
  const liveAll = useLiveStore((s) => s.markets);

  useEffect(() => {
    if (live || catalog) {
      setLookup("idle");
      return;
    }
    let cancelled = false;
    setLookup("loading");
    void getLiveMarket({ data: { slug } }).then((res) => {
      if (cancelled) return;
      if (res.market) {
        setFetched(res.market);
        setLookup("idle");
      } else {
        setLookup("miss");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, live, catalog]);

  if (!market && lookup !== "miss") {
    return (
      <AppShell showTicker={false}>
        <main className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Loading market…</h1>
          <p className="mt-2 text-sm text-muted">Fetching the live book.</p>
        </main>
      </AppShell>
    );
  }

  if (!market) {
    return (
      <AppShell showTicker={false}>
        <main className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Market not found</h1>
          <p className="mt-2 text-sm text-muted">That event isn’t on the book.</p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium underline">
            Back to markets
          </Link>
        </main>
      </AppShell>
    );
  }

  const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
  const volume = pool?.volume ?? market.seedVolume;
  const binary = isBinary(market);
  const yes = prices.yes ?? prices[market.outcomes[0].id] ?? 0;
  const related =
    market.venue === "azuro"
      ? liveAll.filter((m) => m.eventId === market.eventId && m.id !== market.id).slice(0, 4)
      : MARKETS.filter((m) => m.id !== market.id && m.category === market.category).slice(0, 4);
  const onchain = market.venue === "azuro";

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {onchain ? `${market.leagueName ?? "Sports"} · Azuro` : market.category} · {daysUntil(market.endDate)}
              {market.status === "live" ? " · Live" : ""}
              {market.status === "paused" ? " · Paused" : ""}
            </p>
            <div className="mt-2 flex items-start gap-4">
              <img src={market.image} alt="" className="size-16 rounded-md object-cover sm:size-20" />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{market.title}</h1>
                <p className="mt-2 text-sm text-muted">
                  {formatUsd(volume, 0)} Vol
                  {onchain ? " · USDT" : ` · ${formatUsd(market.liquidity, 0)} liquidity`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => watchMarket(market.id)}
                className={cn("rounded-sm p-2 text-subtle hover:text-foreground", watched && "text-foreground")}
                aria-label="Watch"
              >
                <Bookmark className={cn("size-5", watched && "fill-foreground")} />
              </button>
            </div>

            {binary && (
              <div className="mt-6 flex items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">Chance</p>
                  <p className="font-mono text-5xl font-medium tracking-tight tabular-nums">{formatPct(yes)}</p>
                </div>
                <div className="w-40">
                  <SplitBar yes={yes} />
                  <div className="mt-1 flex justify-between text-xs font-medium">
                    <span className="text-yes">Yes</span>
                    <span className="text-no">No</span>
                  </div>
                </div>
              </div>
            )}

            {!binary && (
              <ul className="mt-6 space-y-2">
                {market.outcomes.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 rounded-md bg-card px-3 py-2.5 shadow-[var(--shadow-border)]">
                    <span className="flex-1 text-sm font-medium">{o.label}</span>
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-card-2">
                      <div className="h-full bg-yes" style={{ width: percentWidth(prices[o.id] ?? 0) }} />
                    </div>
                    <span className="w-12 text-right font-mono text-sm tabular-nums">{formatPct(prices[o.id] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}

            {!onchain && (
              <div className="mt-6 rounded-lg bg-card p-3 shadow-[var(--shadow-border)] sm:p-4">
                <ProbabilityChart data={history ?? []} />
              </div>
            )}

            {!onchain && (
              <div className="mt-6">
                <GrokBrief marketId={market.id} />
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-80">
            <TradePanel market={market} initialSide={side} />
          </aside>
        </div>

        <section className="mt-8 max-w-3xl">
          <h2 className="text-sm font-semibold tracking-tight">Rules</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{market.description}</p>
          <p className="mt-3 text-sm leading-relaxed text-subtle">{market.resolution}</p>
          {market.resolutionSource && (
            <p className="mt-2 text-xs text-subtle">Resolution source: {market.resolutionSource}</p>
          )}
          {market.status === "resolved" && market.resolvedOutcomeId && (
            <p className="mt-2 text-sm font-medium">
              Resolved: {market.outcomes.find((o) => o.id === market.resolvedOutcomeId)?.label ?? market.resolvedOutcomeId}
            </p>
          )}
          {market.status === "canceled" && (
            <p className="mt-2 text-sm text-muted">This market was canceled by the protocol oracle.</p>
          )}
        </section>

        {!onchain && (
          <div className="mt-8 max-w-3xl">
            <OrderBook market={market} />
          </div>
        )}

        {!onchain && (
          <section className="mt-8 max-w-3xl rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
            <PriceAlert marketId={market.id} lastCents={Math.round(yes * 100)} />
          </section>
        )}

        {!onchain && (
          <div className="mt-8 max-w-3xl">
            <MarketComments market={market} />
          </div>
        )}

        {!onchain && (
          <div className="mt-8 max-w-3xl">
            <MarketActivity market={market} />
          </div>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Related</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {related.map((m) => (
                <MarketCard key={m.id} market={m} />
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { daysUntil, formatUsd } from "@/lib/format";
import { isBinary } from "@/lib/markets";
import { lmsrPrices } from "@/lib/amm";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/lib/store";
import { watchMarket } from "@/lib/watch";
import { cn } from "@/lib/utils";
import { Chance, OutcomeRow, SplitBar } from "./probability";

export function MarketCard({ market }: { market: Market }) {
  const pool = useMarketStore((s) => s.pools[market.id]);
  const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
  const volume = pool?.volume ?? market.seedVolume;
  const watched = useMarketStore((s) => s.watchlist.includes(market.id));
  const binary = isBinary(market);
  const yes = prices.yes ?? prices[market.outcomes[0].id] ?? 0;

  return (
    <article className="group relative rounded-lg bg-card p-3 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]">
      <Link to="/market/$slug" params={{ slug: market.slug }} className="flex gap-3">
        <img
          src={market.image}
          alt=""
          className="size-20 shrink-0 rounded-sm object-cover sm:size-24"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 pr-8 text-sm leading-snug font-medium tracking-tight text-foreground">
            {market.title}
          </h3>
          <div className="mt-2">
            {binary ? (
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Chance</p>
                  <Chance value={yes} />
                </div>
                <div className="hidden w-36 sm:block">
                  <SplitBar yes={yes} />
                  <div className="mt-1 flex justify-between text-[11px] font-medium">
                    <span className="text-yes">Yes {Math.round(yes * 100)}%</span>
                    <span className="text-no">No {Math.round((1 - yes) * 100)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {market.outcomes.slice(0, 3).map((o) => (
                  <OutcomeRow key={o.id} label={o.label} price={prices[o.id] ?? 0} />
                ))}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-subtle">
            {formatUsd(volume, 0)} Vol · {daysUntil(market.endDate)}
          </p>
        </div>
      </Link>
      {binary && (
        <div className="mt-3 flex gap-2">
          <QuickTradeLink slug={market.slug} side="yes" price={yes} />
          <QuickTradeLink slug={market.slug} side="no" price={1 - yes} />
        </div>
      )}
      <button
        type="button"
        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        onClick={(e) => {
          e.preventDefault();
          watchMarket(market.id);
        }}
        className={cn(
          "absolute top-3 right-3 rounded-sm p-1.5 text-subtle transition-colors hover:text-foreground",
          watched && "text-foreground",
        )}
      >
        <Bookmark className={cn("size-4", watched && "fill-foreground")} />
      </button>
    </article>
  );
}

function QuickTradeLink({ slug, side, price }: { slug: string; side: "yes" | "no"; price: number }) {
  return (
    <Link
      to="/market/$slug"
      params={{ slug }}
      search={{ side }}
      className={cn(
        "flex h-10 flex-1 items-center justify-center rounded-sm text-sm font-medium transition-colors duration-150",
        side === "yes" ? "bg-yes-soft text-yes hover:bg-yes hover:text-yes-fg" : "bg-no-soft text-no hover:bg-no hover:text-no-fg",
      )}
    >
      {side === "yes" ? "Yes" : "No"} {Math.round(price * 100)}¢
    </Link>
  );
}

export function FeaturedCard({ market }: { market: Market }) {
  const pool = useMarketStore((s) => s.pools[market.id]);
  const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
  const volume = pool?.volume ?? market.seedVolume;
  const primary = market.outcomes[0].id;
  const p = prices[primary] ?? 0;

  return (
    <Link
      to="/market/$slug"
      params={{ slug: market.slug }}
      className="w-[280px] shrink-0 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)] sm:w-[320px]"
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={market.image} alt="" className="size-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-foreground/70 to-transparent" />
        <div className="absolute bottom-3 left-3 text-background">
          <p className="text-[11px] font-medium tracking-wide uppercase opacity-80">
            {market.outcomes[0].short ?? market.outcomes[0].label}
          </p>
          <p className="font-mono text-3xl leading-none font-medium tabular-nums">{Math.round(p * 100)}%</p>
        </div>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-snug font-medium">{market.title}</h3>
        <p className="mt-2 text-xs text-subtle">{formatUsd(volume, 0)} Vol</p>
      </div>
    </Link>
  );
}

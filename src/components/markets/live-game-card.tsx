import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import type { Market } from "@/lib/types";
import { formatPct, formatVol } from "@/lib/format";
import { watchMarket } from "@/lib/watch";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function LiveGameCard({ market }: { market: Market }) {
  const watched = useMarketStore((s) => s.watchlist.includes(market.id));
  const outs = market.outcomes.slice(0, 3);
  const twoWay = outs.length <= 2;

  return (
    <article className="min-w-0 overflow-hidden rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex min-w-0 items-start gap-3">
        <img
          src={market.image}
          alt=""
          className="size-12 shrink-0 rounded-md object-cover"
          onError={(e) => {
            e.currentTarget.src = "/markets/stadium.jpg";
          }}
        />
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
            {market.status === "live" ? "Live · " : ""}
            {market.leagueName ?? "Sports"}
          </p>
          <h3 className="truncate text-sm leading-snug font-medium tracking-tight">
            {market.eventTitle ?? market.title}
          </h3>
        </div>
        <button
          type="button"
          aria-label="Watch"
          onClick={() => watchMarket(market.id)}
          className={cn("shrink-0 rounded-sm p-1.5 text-subtle hover:text-foreground", watched && "text-foreground")}
        >
          <Bookmark className={cn("size-4", watched && "fill-foreground")} />
        </button>
      </div>
      {market.rowLabel && market.rowLabel !== "To win" && (
        <p className="mt-2 truncate text-xs text-subtle">{market.rowLabel}</p>
      )}
      {twoWay ? (
        <div className="mt-3 flex min-w-0 gap-2">
          {outs.map((o, i) => (
            <Link
              key={o.id}
              to="/market/$slug"
              params={{ slug: market.slug }}
              search={{ side: o.id }}
              className={cn(
                "flex min-h-12 min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-3",
                i === 0 ? "bg-yes text-yes-fg" : "bg-no text-no-fg",
              )}
            >
              <span className="min-w-0 truncate text-sm font-semibold">{o.short ?? o.label}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {formatPct(market.seed[o.id] ?? 0)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {outs.map((o) => (
            <li key={o.id} className="min-w-0">
              <Link
                to="/market/$slug"
                params={{ slug: market.slug }}
                search={{ side: o.id }}
                className="flex min-h-10 min-w-0 items-center gap-2 rounded-sm px-1 hover:bg-card-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{o.short ?? o.label}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums">{formatPct(market.seed[o.id] ?? 0)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 truncate text-xs text-subtle">{formatVol(market.seedVolume)} · Azuro</p>
    </article>
  );
}

export function LiveGameCardSkeleton() {
  return (
    <div className="min-w-0 animate-pulse rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex gap-3">
        <div className="size-12 shrink-0 rounded-md bg-card-2" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-3 w-24 rounded bg-card-2" />
          <div className="h-4 w-3/4 rounded bg-card-2" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-12 min-w-0 flex-1 rounded-md bg-card-2" />
        <div className="h-12 min-w-0 flex-1 rounded-md bg-card-2" />
      </div>
    </div>
  );
}

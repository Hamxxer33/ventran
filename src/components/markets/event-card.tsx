import { Link } from "@tanstack/react-router";
import { Bookmark, Gift } from "lucide-react";
import { lmsrPrices } from "@/lib/amm";
import type { EventGroup } from "@/lib/catalog";
import { formatVol } from "@/lib/format";
import { isBinary } from "@/lib/markets";
import { useMarketStore } from "@/lib/store";
import { watchMarket } from "@/lib/watch";
import { cn } from "@/lib/utils";

export function EventCard({ group }: { group: EventGroup }) {
  const pools = useMarketStore((s) => s.pools);
  const volume = group.markets.reduce((s, m) => s + (pools[m.id]?.volume ?? m.seedVolume), 0);
  const firstId = group.markets[0]?.id;
  const watched = useMarketStore((s) => (firstId ? s.watchlist.includes(firstId) : false));
  const live = group.markets.some((m) => m.venue === "azuro");

  return (
    <article className="relative rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3 pr-8">
        <img src={group.image} alt="" className="size-12 rounded-md object-cover sm:size-14" />
        <h3 className="pt-0.5 text-sm leading-snug font-medium tracking-tight">{group.title}</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {group.markets.map((m) => {
          const pool = pools[m.id];
          const prices = pool ? lmsrPrices(pool.q, pool.b) : m.seed;
          const binary = isBinary(m);
          const yes = prices.yes ?? prices[m.outcomes[0].id] ?? 0;
          const lead = m.outcomes[0];
          return (
            <li key={m.id} className="flex min-w-0 items-center gap-2">
              <Link
                to="/market/$slug"
                params={{ slug: m.slug }}
                className="min-w-0 flex-1 truncate text-sm text-muted hover:text-foreground"
              >
                {m.rowLabel ?? m.title}
              </Link>
              <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums">
                {Math.round((binary ? yes : prices[lead?.id ?? ""] ?? 0) * 100)}%
              </span>
              {binary ? (
                <>
                  <Link
                    to="/market/$slug"
                    params={{ slug: m.slug }}
                    search={{ side: "yes" }}
                    className="inline-flex h-8 min-w-12 items-center justify-center rounded-sm bg-yes px-2.5 text-xs font-medium text-yes-fg"
                  >
                    Yes
                  </Link>
                  <Link
                    to="/market/$slug"
                    params={{ slug: m.slug }}
                    search={{ side: "no" }}
                    className="inline-flex h-8 min-w-12 items-center justify-center rounded-sm bg-no px-2.5 text-xs font-medium text-no-fg"
                  >
                    No
                  </Link>
                </>
              ) : (
                m.outcomes.slice(0, 2).map((o, i) => (
                  <Link
                    key={o.id}
                    to="/market/$slug"
                    params={{ slug: m.slug }}
                    search={{ side: o.id }}
                    className={cn(
                      "inline-flex h-8 max-w-20 min-w-12 items-center justify-center truncate rounded-sm px-2 text-xs font-medium",
                      i === 0 ? "bg-yes text-yes-fg" : "bg-no text-no-fg",
                    )}
                  >
                    {o.short ?? o.label}
                  </Link>
                ))
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-subtle">
          {formatVol(volume)}
          {live ? " · Azuro" : ""}
        </p>
        <div className="flex items-center">
          <Link to="/rewards" aria-label="Rewards" className="rounded-sm p-1.5 text-subtle hover:text-foreground">
            <Gift className="size-4" />
          </Link>
          {firstId && (
            <button
              type="button"
              aria-label="Watch"
              onClick={() => watchMarket(firstId)}
              className={cn(
                "rounded-sm p-1.5 text-subtle hover:text-foreground",
                watched && "text-foreground",
              )}
            >
              <Bookmark className={cn("size-4", watched && "fill-foreground")} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

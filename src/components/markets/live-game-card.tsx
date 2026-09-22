import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import type { Market } from "@/lib/types";
import { formatVol } from "@/lib/format";
import { watchMarket } from "@/lib/watch";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function LiveGameCard({ market }: { market: Market }) {
  const watched = useMarketStore((s) => s.watchlist.includes(market.id));
  const a = market.outcomes[0];
  const b = market.outcomes[1];
  const pa = market.seed[a?.id ?? ""] ?? 0.5;
  const pb = market.seed[b?.id ?? ""] ?? 1 - pa;
  const oa = market.odds?.[a?.id ?? ""] ?? (pa > 0 ? 1 / pa : 0);
  const ob = market.odds?.[b?.id ?? ""] ?? (pb > 0 ? 1 / pb : 0);

  return (
    <article className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <img src={market.image} alt="" className="size-12 rounded-md object-cover" />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            Live · {market.leagueName ?? "Sports"}
          </p>
          <h3 className="text-sm leading-snug font-medium tracking-tight">{market.eventTitle ?? market.title}</h3>
        </div>
        <button
          type="button"
          aria-label="Watch"
          onClick={() => watchMarket(market.id)}
          className={cn("rounded-sm p-1.5 text-subtle hover:text-foreground", watched && "text-foreground")}
        >
          <Bookmark className={cn("size-4", watched && "fill-foreground")} />
        </button>
      </div>
      <p className="mt-2 text-xs text-subtle">{market.rowLabel}</p>
      <div className="mt-3 flex gap-2">
        {a && (
          <Link
            to="/market/$slug"
            params={{ slug: market.slug }}
            search={{ side: a.id }}
            className="flex min-h-12 flex-1 items-center justify-between rounded-md bg-yes px-3 text-yes-fg"
          >
            <span className="text-sm font-semibold">{a.short ?? a.label}</span>
            <span className="font-mono text-xs tabular-nums">{oa.toFixed(2)}</span>
          </Link>
        )}
        {b && (
          <Link
            to="/market/$slug"
            params={{ slug: market.slug }}
            search={{ side: b.id }}
            className="flex min-h-12 flex-1 items-center justify-between rounded-md bg-no px-3 text-no-fg"
          >
            <span className="text-sm font-semibold">{b.short ?? b.label}</span>
            <span className="font-mono text-xs tabular-nums">{ob.toFixed(2)}</span>
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs text-subtle">{formatVol(market.seedVolume)} · Azuro</p>
    </article>
  );
}

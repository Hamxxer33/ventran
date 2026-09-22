import { useMemo } from "react";
import { formatTimeAgo, formatUsd } from "@/lib/format";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/lib/store";

export function MarketActivity({ market }: { market: Market }) {
  const trades = useMarketStore((s) => s.trades);
  const rows = useMemo(() => {
    const yours = trades
      .filter((t) => t.marketId === market.id)
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        user: "You",
        text: `${t.action === "buy" ? "Bought" : "Sold"} ${market.outcomes.find((o) => o.id === t.outcomeId)?.label ?? t.outcomeId} · ${formatUsd(t.cost)} @ ${Math.round(t.price * 100)}¢`,
        at: t.at,
      }));
    const comments = market.comments.map((c) => ({
      id: c.id,
      user: c.user,
      text: c.text,
      at: c.at,
    }));
    return [...yours, ...comments].sort((a, b) => b.at - a.at);
  }, [trades, market]);

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
      <ul className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card-2 text-xs font-semibold">
              {row.user.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">{row.user}</span>{" "}
                <span className="text-muted">{row.text}</span>
              </p>
              <p className="mt-0.5 text-xs text-subtle">{formatTimeAgo(row.at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

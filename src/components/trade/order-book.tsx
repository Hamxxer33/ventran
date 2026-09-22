import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { lmsrPrices } from "@/lib/amm";
import { useClientSession } from "@/lib/use-client-session";
import { formatUsd } from "@/lib/format";
import { listBook } from "@/lib/server/desk";
import { useMarketStore } from "@/lib/store";
import type { Market } from "@/lib/types";
import { cn } from "@/lib/utils";

type Rest = {
  id: number;
  handle: string;
  side: "buy" | "sell";
  outcomeId: string;
  limitPrice: number;
  amount: number;
};

export function OrderBook({ market }: { market: Market }) {
  const pool = useMarketStore((s) => s.pools[market.id]);
  const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
  const primary = market.outcomes[0];
  const p = prices[primary.id] ?? 0.5;
  const volume = pool?.volume ?? market.seedVolume;
  const { user, isPending } = useClientSession();
  const [rest, setRest] = useState<Rest[]>([]);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void listBook({ data: market.id })
      .then((rows) => {
        if (!cancelled) setRest(rows);
      })
      .catch(() => {
        if (!cancelled) setRest([]);
      });
    return () => {
      cancelled = true;
    };
  }, [market.id, user, isPending]);

  const asks = implied(p, volume, "ask");
  const bids = implied(p, volume, "bid");
  const resting = rest.filter((r) => r.outcomeId === primary.id);

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Order book</h2>
        <p className="text-xs text-subtle">Implied LMSR depth · {primary.label}</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] tracking-wide text-muted uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Side</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {asks.map((row) => (
              <BookRow key={`a-${row.px}`} side="Ask" price={row.px} size={row.size} tone="no" />
            ))}
            <tr className="bg-card-2">
              <td className="px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase">Last</td>
              <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">{Math.round(p * 100)}¢</td>
              <td className="px-4 py-2 text-right font-mono text-xs text-subtle tabular-nums">
                {formatUsd(volume, 0)} vol
              </td>
            </tr>
            {bids.map((row) => (
              <BookRow key={`b-${row.px}`} side="Bid" price={row.px} size={row.size} tone="yes" />
            ))}
          </tbody>
        </table>
      </div>
      {resting.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
          {resting.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <Link to="/u/$handle" params={{ handle: r.handle }} className="font-medium hover:underline">
                @{r.handle}
              </Link>
              <span className={cn("font-mono text-xs tabular-nums", r.side === "buy" ? "text-yes" : "text-no")}>
                {r.side} {Math.round(r.limitPrice * 100)}¢ · {formatUsd(r.amount, 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function implied(p: number, volume: number, side: "bid" | "ask") {
  const rows: { px: number; size: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    const px = side === "bid" ? p - i * 0.02 : p + i * 0.02;
    if (px <= 0.02 || px >= 0.98) continue;
    const size = Math.max(40, Math.round(volume * 0.0035 * (6 - i)));
    rows.push({ px, size });
  }
  if (side === "ask") rows.reverse();
  return rows;
}

function BookRow({
  side,
  price,
  size,
  tone,
}: {
  side: string;
  price: number;
  size: number;
  tone: "yes" | "no";
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className={cn("px-4 py-1.5 text-xs font-medium", tone === "yes" ? "text-yes" : "text-no")}>{side}</td>
      <td className="px-4 py-1.5 text-right font-mono text-sm tabular-nums">{Math.round(price * 100)}¢</td>
      <td className="px-4 py-1.5 text-right font-mono text-xs text-muted tabular-nums">{formatUsd(size, 0)}</td>
    </tr>
  );
}

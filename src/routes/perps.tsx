import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { LiveCard } from "@/components/markets/live-card";
import { PERPS } from "@/lib/catalog";
import { formatUsdFull } from "@/lib/format";
import { usePerpStore } from "@/lib/perp-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perps")({ component: PerpsPage });

function PerpsPage() {
  const positions = usePerpStore((s) => s.positions);
  const open = positions.filter((p) => !p.settled);
  const closed = positions.filter((p) => p.settled).slice(0, 12);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Perps</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Up or Down, five minutes</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          A new round every five minutes. Pick a side, size it, get paid if the round resolves your way.
          Paper USDC — the path is simulated on the desk, not a live CEX feed.
        </p>
        <div className="mt-6 grid gap-3">
          {PERPS.map((p) => (
            <LiveCard key={p.id} perp={p} />
          ))}
        </div>
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Open this round</h2>
          {open.length === 0 ? (
            <p className="mt-3 rounded-lg bg-card px-4 py-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
              No open 5m tickets. Tap Up or Down.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {open.map((p) => (
                <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
                  <span className="font-medium capitalize">
                    {p.perpId.replace("-5m", "").toUpperCase()} {p.side}
                  </span>
                  <span className="font-mono tabular-nums">{formatUsdFull(p.stake)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-tight">Settled</h2>
          {closed.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Rounds settle when the clock hits zero.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {closed.map((p) => (
                <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
                  <span className="capitalize">
                    {p.perpId.replace("-5m", "").toUpperCase()} {p.side}
                  </span>
                  <span className={cn("font-mono tabular-nums", p.won ? "text-yes" : "text-no")}>
                    {p.won ? `+${formatUsdFull(p.stake / p.price - p.stake)}` : `-${formatUsdFull(p.stake)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}

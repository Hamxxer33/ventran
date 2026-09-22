import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { COMBOS, comboQuote } from "@/lib/catalog";
import { formatUsdFull } from "@/lib/format";
import { useClientSession } from "@/lib/use-client-session";
import { bootstrapDesk, placeParlay } from "@/lib/server/desk";
import { useMarketStore } from "@/lib/store";

export const Route = createFileRoute("/combos")({ component: CombosPage });

function CombosPage() {
  const pools = useMarketStore((s) => s.pools);
  const cash = useMarketStore((s) => s.cash);
  const applySnapshot = useMarketStore((s) => s.applySnapshot);
  const { user, isPending } = useClientSession();
  const navigate = useNavigate();
  const [stake, setStake] = useState(25);
  const [busy, setBusy] = useState<string | null>(null);

  async function lock(id: string) {
    const combo = COMBOS.find((c) => c.id === id);
    if (!combo) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (busy) return;
    setBusy(id);
    try {
      const res = await placeParlay({ data: { stake, legs: combo.legs } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const snap = await bootstrapDesk({ data: { displayName: user.displayName } });
      applySnapshot(snap);
      toast.success(`Combo locked · ${formatUsdFull(res.payout)} if all hit`);
    } catch {
      toast.error("Could not lock combo");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Combos</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Stack the book</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Two or three legs, one stake. Pays only if every leg hits. Paper USDC.
        </p>
        <div className="mt-4 flex gap-1.5">
          {[10, 25, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStake(n)}
              className={`h-8 rounded-sm px-3 text-xs font-medium ${stake === n ? "bg-primary text-primary-fg" : "bg-card-2 text-muted"}`}
            >
              ${n}
            </button>
          ))}
          <span className="ml-auto self-center font-mono text-xs text-subtle tabular-nums">
            Cash {formatUsdFull(cash)}
          </span>
        </div>
        <ul className="mt-6 space-y-3">
          {COMBOS.map((combo) => {
            const q = comboQuote(combo, pools);
            const payout = q.combined > 0 ? stake / q.combined : 0;
            return (
              <li key={combo.id} className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
                <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{combo.kicker}</p>
                <h2 className="mt-1 text-sm font-semibold tracking-tight">{combo.title}</h2>
                <ul className="mt-3 space-y-1.5">
                  {q.legs.map((leg) => (
                    <li key={`${leg.market.id}-${leg.outcomeId}`} className="flex justify-between text-sm">
                      <Link
                        to="/market/$slug"
                        params={{ slug: leg.market.slug }}
                        className="min-w-0 truncate text-muted hover:text-foreground"
                      >
                        {leg.market.outcomes.find((o) => o.id === leg.outcomeId)?.label} · {leg.market.title}
                      </Link>
                      <span className="ml-3 shrink-0 font-mono tabular-nums">{Math.round(leg.price * 100)}¢</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">Combined</p>
                    <p className="font-mono text-lg tabular-nums">{Math.round(q.combined * 100)}¢</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Pays if all hit</p>
                    <p className="font-mono text-lg tabular-nums">{formatUsdFull(payout)}</p>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={Boolean(busy) || isPending}
                  onClick={() => void lock(combo.id)}
                >
                  {busy === combo.id ? "Working…" : user ? `Lock $${stake}` : "Sign in to lock"}
                </Button>
              </li>
            );
          })}
        </ul>
      </main>
    </AppShell>
  );
}

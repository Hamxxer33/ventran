import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RankBar, RankChip } from "@/components/profile/rank-chip";
import { Button } from "@/components/ui/button";
import { usePerpStore } from "@/lib/perp-store";
import { rankForXp } from "@/lib/ranks";
import { useMarketStore } from "@/lib/store";

export const Route = createFileRoute("/rewards")({ component: RewardsPage });

function RewardsPage() {
  const xp = useMarketStore((s) => s.xp);
  const linked = useMarketStore((s) => s.linked);
  const lastClaim = usePerpStore((s) => s.lastClaim);
  const claimWeekly = usePerpStore((s) => s.claimWeekly);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);
  const week = 7 * 24 * 3600 * 1000;
  const ready = now !== null && now - lastClaim >= week;
  const rank = rankForXp(xp || (linked ? 0 : 0));

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Rewards</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Paper yield</h1>
        <p className="mt-2 text-sm text-muted">
          XP from fills, limits, combos, and comments. A weekly $500 paper drop for showing up.
        </p>
        <div className="mt-6 rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between">
            <RankChip xp={xp} />
            <span className="font-mono text-sm tabular-nums">{xp} XP</span>
          </div>
          <div className="mt-3">
            <RankBar xp={xp} />
          </div>
          <p className="mt-2 text-xs text-subtle">
            {rank.next ? `${rank.next - xp} XP to ${rankForXp(rank.next).name}` : "Top of the desk"}
          </p>
        </div>
        <div className="mt-4 rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-semibold">Weekly paper drop</h2>
          <p className="mt-1 text-sm text-muted">$500 paper USDC, once every seven days. Local desk, not on-chain.</p>
          <Button
            className="mt-4 w-full"
            disabled={!ready}
            onClick={() => {
              const res = claimWeekly(Date.now());
              if (!res.ok) toast.error(res.error);
              else toast.success("Claimed $500 paper USDC");
              setNow(Date.now());
            }}
          >
            {ready ? "Claim $500" : "Already claimed"}
          </Button>
        </div>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li>Market fill · 10 XP</li>
          <li>Limit fill · 15 XP</li>
          <li>Combo · 25 XP</li>
          <li>Copy a desk · 20 XP</li>
          <li>Comment · 8 XP</li>
        </ul>
      </main>
    </AppShell>
  );
}

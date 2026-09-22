import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TraderAvatar } from "@/components/profile/avatar";
import { RankChip } from "@/components/profile/rank-chip";
import { useClientSession } from "@/lib/use-client-session";
import { formatSignedUsd, formatUsdFull } from "@/lib/format";
import { getLeaders } from "@/lib/server/desk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaders")({ component: LeadersPage });

type Row = Awaited<ReturnType<typeof getLeaders>>[number];

function LeadersPage() {
  const { user, isPending } = useClientSession();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void getLeaders()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Shared desk</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Leaders</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Ranked by paper P&L versus deposits. Follow a book, then copy a position from their
          profile.
        </p>

        {isPending ? (
          <div className="mt-8 h-48 animate-pulse rounded-lg bg-card" />
        ) : !user ? (
          <div className="mt-8 rounded-lg bg-card px-4 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">The board is live for signed-in desks.</p>
            <Link to="/login" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
              Sign in
            </Link>
          </div>
        ) : rows === null ? (
          <div className="mt-8 h-48 animate-pulse rounded-lg bg-card" />
        ) : rows.length === 0 ? (
          <p className="mt-8 text-sm text-muted">No desks yet. Trade to appear.</p>
        ) : (
          <ol className="mt-8 divide-y divide-border overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
            {rows.map((row, i) => (
              <li key={row.profile.userId}>
                <Link
                  to="/u/$handle"
                  params={{ handle: row.profile.handle }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-card-2"
                >
                  <span className="w-6 font-mono text-sm text-subtle tabular-nums">{i + 1}</span>
                  <TraderAvatar handle={row.profile.handle} hue={row.profile.avatarHue} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.profile.displayName}</p>
                    <p className="text-xs text-muted">@{row.profile.handle}</p>
                  </div>
                  <RankChip xp={row.profile.xp} className="hidden sm:inline-flex" />
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums">{formatUsdFull(row.equity)}</p>
                    <p
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        row.pnl > 0 && "text-yes",
                        row.pnl < 0 && "text-no",
                      )}
                    >
                      {formatSignedUsd(row.pnl)} · {(row.roi * 100).toFixed(0)}%
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </AppShell>
  );
}

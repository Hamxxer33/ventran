import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TraderAvatar } from "@/components/profile/avatar";
import { useClientSession } from "@/lib/use-client-session";
import { formatTimeAgo, formatUsdFull } from "@/lib/format";
import { MARKET_BY_ID } from "@/lib/markets";
import { hueFromId } from "@/lib/ranks";
import { getTape } from "@/lib/server/desk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({ component: FeedPage });

type Tape = Awaited<ReturnType<typeof getTape>>;

function FeedPage() {
  const { user, isPending } = useClientSession();
  const [data, setData] = useState<Tape | null>(null);
  const [onlyFollow, setOnlyFollow] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void getTape()
      .then((t) => {
        if (!cancelled) setData(t);
      })
      .catch(() => {
        if (!cancelled) setData({ following: [], tape: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (!onlyFollow) return data.tape;
    const set = new Set(data.following);
    return data.tape.filter((t) => set.has(t.userId));
  }, [data, onlyFollow]);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Live desk</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Trade tape</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Fills across the shared book. Follow a trader on their profile to filter the tape.
        </p>

        {isPending ? (
          <div className="mt-8 h-48 animate-pulse rounded-lg bg-card" />
        ) : !user ? (
          <div className="mt-8 rounded-lg bg-card px-4 py-10 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">Sign in to watch the shared tape.</p>
            <Link to="/login" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex rounded-sm bg-card-2 p-1">
              <button
                type="button"
                onClick={() => setOnlyFollow(false)}
                className={cn(
                  "h-9 flex-1 rounded-xs text-sm font-medium",
                  !onlyFollow ? "bg-card shadow-[var(--shadow-border)]" : "text-muted",
                )}
              >
                All desks
              </button>
              <button
                type="button"
                onClick={() => setOnlyFollow(true)}
                className={cn(
                  "h-9 flex-1 rounded-xs text-sm font-medium",
                  onlyFollow ? "bg-card shadow-[var(--shadow-border)]" : "text-muted",
                )}
              >
                Following
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="mt-6 rounded-lg bg-card px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
                {onlyFollow ? "Follow a trader to fill this tape." : "No fills yet."}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
                {rows.map((t) => {
                  const m = MARKET_BY_ID[t.marketId];
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <TraderAvatar handle={t.handle} hue={hueFromId(t.userId)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <Link
                            to="/u/$handle"
                            params={{ handle: t.handle }}
                            className="font-medium hover:underline"
                          >
                            @{t.handle}
                          </Link>{" "}
                          <span className={cn("capitalize", t.action === "buy" ? "text-yes" : "text-no")}>
                            {t.action}
                          </span>{" "}
                          <span className="text-muted">
                            {m?.outcomes.find((o) => o.id === t.outcomeId)?.label} · {m?.title}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">{formatTimeAgo(new Date(t.at).getTime())}</p>
                      </div>
                      <span className="shrink-0 font-mono text-sm tabular-nums">{formatUsdFull(t.cost)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

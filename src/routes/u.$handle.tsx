import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { TraderAvatar } from "@/components/profile/avatar";
import { RankBar, RankChip } from "@/components/profile/rank-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lmsrPrices } from "@/lib/amm";
import { useClientSession } from "@/lib/use-client-session";
import { formatShares, formatSignedUsd, formatUsdFull } from "@/lib/format";
import { MARKET_BY_ID } from "@/lib/markets";
import { badgesFor, rankForXp } from "@/lib/ranks";
import {
  copyPosition,
  getProfileByHandle,
  toggleFollow,
  updateMyProfile,
  type Profile,
} from "@/lib/server/desk";
import { positionValue, useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$handle")({ component: ProfilePage });

type Loaded = NonNullable<Extract<Awaited<ReturnType<typeof getProfileByHandle>>, { ok: true }>>;

function ProfilePage() {
  const { handle } = Route.useParams();
  const { user, isPending } = useClientSession();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const patchAfterTrade = useMarketStore((s) => s.patchAfterTrade);
  const patchProfile = useMarketStore((s) => s.patchProfile);

  useEffect(() => {
    if (isPending) return;
    if (!user) return;
    let cancelled = false;
    setData(null);
    setError(null);
    void getProfileByHandle({ data: handle })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setError(res.error);
        else setData(res);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load profile.");
      });
    return () => {
      cancelled = true;
    };
  }, [handle, user, isPending]);

  if (isPending) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-24 animate-pulse rounded-lg bg-card" />
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Trader profiles</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to open public desks, follow a book, and copy a position.
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm font-medium underline underline-offset-2">
            Sign in
          </Link>
        </main>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <main className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">{error ?? "Loading…"}</h1>
          <Link to="/leaders" className="mt-6 inline-block text-sm font-medium underline">
            Back to leaders
          </Link>
        </main>
      </AppShell>
    );
  }

  return (
    <ProfileView
      data={data}
      onFollow={(following) => setData({ ...data, iFollow: following, followers: data.followers + (following ? 1 : -1) })}
      onCopied={(res) => {
        patchAfterTrade({
          pool: res.pool,
          marketId: res.marketId,
          profile: res.profile,
          positions: res.positions,
        });
      }}
      onSaved={(profile) => {
        patchProfile(profile);
        setData({ ...data, profile });
      }}
    />
  );
}

function ProfileView({
  data,
  onFollow,
  onCopied,
  onSaved,
}: {
  data: Loaded;
  onFollow: (following: boolean) => void;
  onCopied: (res: {
    pool: (typeof data)["pools"][string];
    marketId: string;
    profile: Profile;
    positions: Loaded["positions"];
  }) => void;
  onSaved: (profile: Profile) => void;
}) {
  const { profile, positions, fills, followers, following, iFollow, isSelf, stats, pools } = data;
  const rank = rankForXp(profile.xp);
  const badges = badgesFor(stats);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const valued = positions.map((p) => {
    const market = MARKET_BY_ID[p.marketId];
    const pool = pools[p.marketId];
    const prices = pool ? lmsrPrices(pool.q, pool.b) : (market?.seed ?? {});
    const value = positionValue(p, prices);
    return { ...p, market, value, pnl: value - p.cost, price: prices[p.outcomeId] ?? 0 };
  });
  const posValue = valued.reduce((s, p) => s + p.value, 0);
  const equity = profile.cash + posValue;
  const pnl = equity - profile.deposited;

  async function follow() {
    if (busy || isSelf) return;
    setBusy(true);
    try {
      const res = await toggleFollow({ data: profile.handle });
      onFollow(res.following);
    } catch {
      toast.error("Follow failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(p: (typeof valued)[number]) {
    if (busy || isSelf) return;
    setBusy(true);
    try {
      const res = await copyPosition({
        data: { handle: profile.handle, marketId: p.marketId, outcomeId: p.outcomeId },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onCopied({ ...res, marketId: p.marketId });
      toast.success(`Copied @${profile.handle}`);
    } catch {
      toast.error("Copy failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-start gap-4">
          <TraderAvatar handle={profile.handle} hue={profile.avatarHue} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
              <RankChip xp={profile.xp} />
            </div>
            <p className="mt-0.5 text-sm text-muted">@{profile.handle}</p>
            {profile.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}
            <p className="mt-2 text-xs text-subtle">
              {followers} followers · {following} following · {rank.name}
            </p>
          </div>
          {isSelf ? null : (
            <Button size="sm" variant={iFollow ? "outline" : "default"} onClick={() => void follow()} disabled={busy}>
              {iFollow ? "Following" : "Follow"}
            </Button>
          )}
        </div>

        <div className="mt-6">
          <RankBar xp={profile.xp} />
        </div>

        {badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-card-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Equity" value={formatUsdFull(equity)} />
          <Stat label="Open P&L" value={formatSignedUsd(pnl)} tone={pnl > 0 ? "yes" : pnl < 0 ? "no" : undefined} />
          <Stat label="Volume" value={formatUsdFull(stats.volume)} />
        </div>

        {isSelf && (
          <EditProfile
            profile={profile}
            onSaved={(p) => {
              onSaved(p);
              if (p.handle !== profile.handle) {
                void navigate({ to: "/u/$handle", params: { handle: p.handle } });
              }
            }}
          />
        )}

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Open book</h2>
          {valued.length === 0 ? (
            <p className="mt-3 rounded-lg bg-card px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
              No open positions.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {valued.map((p) => (
                <li
                  key={`${p.marketId}-${p.outcomeId}`}
                  className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-[var(--shadow-border)] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    {p.market ? (
                      <Link
                        to="/market/$slug"
                        params={{ slug: p.market.slug }}
                        className="font-medium hover:underline"
                      >
                        {p.market.title}
                      </Link>
                    ) : (
                      p.marketId
                    )}
                    <p className="mt-1 text-sm text-muted">
                      {p.market?.outcomes.find((o) => o.id === p.outcomeId)?.label ?? p.outcomeId} ·{" "}
                      {formatShares(p.shares)} sh
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-mono text-sm tabular-nums">{formatUsdFull(p.value)}</span>
                    <span
                      className={cn(
                        "font-mono text-sm tabular-nums",
                        p.pnl > 0 && "text-yes",
                        p.pnl < 0 && "text-no",
                      )}
                    >
                      {formatSignedUsd(p.pnl)}
                    </span>
                  </div>
                  {!isSelf && (
                    <Button size="sm" variant="outline" onClick={() => void copy(p)} disabled={busy}>
                      Copy
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Recent fills</h2>
          {fills.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Quiet tape.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {fills.map((f) => {
                const m = MARKET_BY_ID[f.marketId];
                return (
                  <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium capitalize">{f.action}</span>{" "}
                      <span className="text-muted">
                        {m?.outcomes.find((o) => o.id === f.outcomeId)?.label} · {m?.title}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">{formatUsdFull(f.cost)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function EditProfile({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [handle, setHandle] = useState(profile.handle);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await updateMyProfile({ data: { handle, displayName, bio } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSaved(res.profile);
      toast.success("Profile saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="text-sm font-semibold tracking-tight">Edit desk card</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Handle</span>
          <Input className="mt-1.5" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </label>
        <label>
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Name</span>
          <Input className="mt-1.5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 240))}
          rows={3}
          className="mt-1.5 w-full resize-none rounded-sm bg-background px-3 py-2 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </label>
      <Button size="sm" className="mt-3" onClick={() => void save()} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "yes" | "no" }) {
  return (
    <div className="rounded-lg bg-card px-4 py-4 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-medium tabular-nums",
          tone === "yes" && "text-yes",
          tone === "no" && "text-no",
        )}
      >
        {value}
      </p>
    </div>
  );
}

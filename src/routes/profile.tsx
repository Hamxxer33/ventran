import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { TraderAvatar } from "@/components/profile/avatar";
import { RankBar, RankChip } from "@/components/profile/rank-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatSignedUsd, formatUsdFull } from "@/lib/format";
import { computeDeskPnl } from "@/lib/pnl";
import { hueFromId } from "@/lib/ranks";
import { sharePnlCard } from "@/lib/share-card";
import { deleteMyAccount } from "@/lib/server/desk";
import { signOut } from "@/lib/auth/client";
import { useClientSession } from "@/lib/use-client-session";
import { usePerpStore } from "@/lib/perp-store";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({ component: MyProfile });

function MyProfile() {
  const { user, isPending } = useClientSession();
  const cash = useMarketStore((s) => s.cash);
  const deposited = useMarketStore((s) => s.deposited);
  const positions = useMarketStore((s) => s.positions);
  const pools = useMarketStore((s) => s.pools);
  const parlays = useMarketStore((s) => s.parlays);
  const handle = useMarketStore((s) => s.handle);
  const xp = useMarketStore((s) => s.xp);
  const linked = useMarketStore((s) => s.linked);
  const reset = useMarketStore((s) => s.reset);
  const unlink = useMarketStore((s) => s.unlink);
  const perpPositions = usePerpStore((s) => s.positions);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sharing, setSharing] = useState(false);

  const pnl = useMemo(
    () =>
      computeDeskPnl({
        cash,
        deposited,
        positions,
        pools,
        perpPositions,
        parlays,
        now: Date.now(),
      }),
    [cash, deposited, positions, pools, perpPositions, parlays],
  );

  const name = handle ?? "trader";
  const hue = hueFromId(user?.id ?? name);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const mode = await sharePnlCard({
        handle: name,
        realized: pnl.realized,
        unrealized: pnl.unrealized,
        total: pnl.total,
      });
      toast.success(mode === "shared" ? "Share sheet opened" : "P&L card saved");
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError" ? null : "Could not share the card";
      if (msg) toast.error(msg);
    } finally {
      setSharing(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    setBusy(true);
    try {
      if (user && linked) {
        const res = await deleteMyAccount();
        if (!res.ok) throw new Error(res.error);
        unlink();
        usePerpStore.setState({ positions: [], lastClaim: 0 });
        setConfirm(false);
        toast.success("Account deleted");
        await signOut("/").catch(() => {
          window.location.href = "/";
        });
        return;
      }
      reset();
      usePerpStore.setState({ positions: [], lastClaim: 0 });
      setConfirm(false);
      toast.success("Paper desk cleared");
    } catch {
      toast.error("Could not delete the desk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Profile</p>
        <div className="mt-3 flex items-center gap-3">
          <TraderAvatar handle={name} hue={hue} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">@{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {linked && <RankChip xp={xp} />}
              <span className="text-xs text-subtle">
                {linked ? "Shared desk" : "Local paper desk"}
              </span>
            </div>
          </div>
        </div>
        {linked && (
          <div className="mt-4">
            <RankBar xp={xp} />
          </div>
        )}
        {!isPending && !user && (
          <p className="mt-4 text-sm text-muted">
            Sign in with Google or X to keep this book across devices.{" "}
            <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
              Sign up
            </Link>
          </p>
        )}

        <section className="mt-8 grid grid-cols-2 gap-3">
          <Stat label="Realized" value={pnl.realized} />
          <Stat label="Unrealized" value={pnl.unrealized} />
        </section>
        <p className="mt-3 text-sm text-muted">
          Equity {formatUsdFull(pnl.equity)} · total {formatSignedUsd(pnl.total)}
        </p>

        <article className="mt-8 overflow-hidden rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Ventran</p>
          <p className="mt-6 text-sm text-muted">@{name}</p>
          <p
            className={cn(
              "mt-1 font-mono text-4xl font-medium tracking-tight tabular-nums",
              pnl.total > 0 ? "text-yes" : pnl.total < 0 ? "text-no" : "text-foreground",
            )}
          >
            {formatSignedUsd(pnl.total)}
          </p>
          <p className="mt-1 text-xs text-subtle">Total P&L · paper USDC</p>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted">Realized</p>
              <p className={cn("mt-1 font-mono text-lg tabular-nums", tone(pnl.realized))}>
                {formatSignedUsd(pnl.realized)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Unrealized</p>
              <p className={cn("mt-1 font-mono text-lg tabular-nums", tone(pnl.unrealized))}>
                {formatSignedUsd(pnl.unrealized)}
              </p>
            </div>
          </div>
          <p className="mt-8 text-xs text-subtle">Trade what’s next</p>
        </article>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void onShare()} disabled={sharing}>
            Share P&L card
          </Button>
          <Button variant="outline" asChild>
            <Link to="/portfolio">Open book</Link>
          </Button>
        </div>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-sm font-semibold tracking-tight">Delete account</h2>
          <p className="mt-2 text-sm text-muted">
            {user
              ? "Wipes your shared desk — positions, fills, follows, and this sign-in. Paper USDC only. Cannot be undone."
              : "Clears the local paper desk on this device."}
          </p>
          <Button variant="outline" className="mt-4 text-no" onClick={() => setConfirm(true)}>
            Delete account
          </Button>
        </section>
      </main>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Delete this desk?</DialogTitle>
          <DialogDescription>
            {user
              ? "Your profile, positions, and sign-in will be removed from Ventran. You can sign in again later with an empty book."
              : "Local positions, tickets, and cash reset to $10,000 paper USDC."}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="no" onClick={() => void onDelete()} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-card px-4 py-4 shadow-[var(--shadow-border)]">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-xl tabular-nums", tone(value))}>{formatSignedUsd(value)}</p>
    </div>
  );
}

function tone(n: number) {
  if (n > 0) return "text-yes";
  if (n < 0) return "text-no";
  return "text-foreground";
}

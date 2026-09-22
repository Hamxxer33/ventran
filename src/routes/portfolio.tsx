import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { polygon } from "wagmi/chains";
import { AppShell } from "@/components/layout/app-shell";
import { RankBar, RankChip } from "@/components/profile/rank-chip";
import { Button } from "@/components/ui/button";
import { WalletChip } from "@/components/wallet/connect";
import { lmsrPrices } from "@/lib/amm";
import { formatShares, formatSignedUsd, formatUsdFull } from "@/lib/format";
import { MARKET_BY_ID, MARKETS } from "@/lib/markets";
import { cashoutAzuroBet, claimAzuroPayout } from "@/lib/protocol/azuro-exit";
import { azuroChainId } from "@/lib/protocol/config";
import { cancelLimit, depositCash } from "@/lib/server/desk";
import { listWalletBets, type WalletBet } from "@/lib/server/live";
import { positionValue, useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

function PortfolioPage() {
  const cash = useMarketStore((s) => s.cash);
  const positions = useMarketStore((s) => s.positions);
  const trades = useMarketStore((s) => s.trades);
  const watchlist = useMarketStore((s) => s.watchlist);
  const pools = useMarketStore((s) => s.pools);
  const deposit = useMarketStore((s) => s.deposit);
  const reset = useMarketStore((s) => s.reset);
  const linked = useMarketStore((s) => s.linked);
  const handle = useMarketStore((s) => s.handle);
  const xp = useMarketStore((s) => s.xp);
  const deposited = useMarketStore((s) => s.deposited);
  const orders = useMarketStore((s) => s.orders);
  const parlays = useMarketStore((s) => s.parlays);
  const patchProfile = useMarketStore((s) => s.patchProfile);
  const { address, isConnected, chainId } = useAccount();
  const { data: wallet } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const need = azuroChainId();
  const [chainBets, setChainBets] = useState<WalletBet[]>([]);
  const [busyBet, setBusyBet] = useState<string | null>(null);

  async function reloadBets() {
    if (!address) {
      setChainBets([]);
      return;
    }
    const res = await listWalletBets({ data: address });
    if (res.ok) setChainBets(res.bets.slice(0, 20));
  }

  useEffect(() => {
    if (!address) {
      setChainBets([]);
      return;
    }
    let cancelled = false;
    void listWalletBets({ data: address }).then((res) => {
      if (cancelled || !res.ok) return;
      setChainBets(res.bets.slice(0, 20));
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const valued = positions.map((p) => {
    const market = MARKET_BY_ID[p.marketId];
    const pool = pools[p.marketId];
    const prices = pool ? lmsrPrices(pool.q, pool.b) : (market?.seed ?? {});
    const value = positionValue(p, prices);
    return { ...p, market, value, pnl: value - p.cost, price: prices[p.outcomeId] ?? 0 };
  });
  const posValue = valued.reduce((s, p) => s + p.value, 0);
  const pnl = valued.reduce((s, p) => s + p.pnl, 0);
  const equity = cash + posValue;
  const totalPnl = equity - deposited;

  async function onDeposit() {
    try {
      if (linked) {
        const profile = await depositCash({ data: 2500 });
        patchProfile(profile);
      } else {
        deposit(2500);
      }
      toast.success("Deposited $2,500 paper USDC");
    } catch {
      toast.error("Deposit failed");
    }
  }

  async function ensureNetwork(): Promise<boolean> {
    if (chainId === need) return true;
    switchChain({ chainId: need === 137 ? polygon.id : need });
    toast.message("Switch to Polygon to manage this book.");
    return false;
  }

  async function onCashout(bet: WalletBet) {
    if (busyBet || !address || !wallet || !bet.graphBetId) return;
    if (!(await ensureNetwork())) return;
    setBusyBet(bet.id);
    try {
      const res = await cashoutAzuroBet({
        wallet,
        account: address,
        chainId: chainId ?? need,
        graphBetId: bet.graphBetId,
        marketId: bet.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.txHash
          ? `Cashed out ${formatUsdFull(res.amount)} · ${res.txHash.slice(0, 10)}…`
          : `Cashed out ${formatUsdFull(res.amount)}`,
      );
      await reloadBets();
    } finally {
      setBusyBet(null);
    }
  }

  async function onClaim(bet: WalletBet) {
    if (busyBet || !address || !wallet || !publicClient || !bet.tokenId) return;
    if (!(await ensureNetwork())) return;
    setBusyBet(bet.id);
    try {
      const res = await claimAzuroPayout({
        wallet,
        account: address,
        chainId: chainId ?? need,
        tokenId: bet.tokenId,
        core: bet.core,
        lpAddress: bet.lpAddress,
        marketId: bet.id,
        amountUsd: bet.payout ?? bet.amount,
        publicClient,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Claimed · ${res.txHash.slice(0, 10)}…`);
      await reloadBets();
    } finally {
      setBusyBet(null);
    }
  }

  async function onCancel(id: number) {
    try {
      await cancelLimit({ data: id });
      useMarketStore.setState({ orders: orders.filter((o) => o.id !== id) });
      toast.success("Limit cancelled");
    } catch {
      toast.error("Could not cancel");
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {linked ? "Shared desk" : "Paper account"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          {linked && <RankChip xp={xp} />}
          {handle && (
            <Link to="/u/$handle" params={{ handle }} className="text-sm text-muted underline underline-offset-2">
              @{handle}
            </Link>
          )}
        </div>
        {linked && (
          <div className="mt-4 max-w-md">
            <RankBar xp={xp} />
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Equity" value={formatUsdFull(equity)} />
          <Stat label="Cash" value={formatUsdFull(cash)} />
          <Stat
            label="Open P&L"
            value={formatSignedUsd(linked ? totalPnl : pnl)}
            tone={(linked ? totalPnl : pnl) > 0 ? "yes" : (linked ? totalPnl : pnl) < 0 ? "no" : undefined}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void onDeposit()}>
            Deposit $2,500
          </Button>
          {!linked && (
            <Button size="sm" variant="outline" onClick={reset}>
              Reset account
            </Button>
          )}
          {linked && (
            <p className="self-center text-xs text-subtle">Shared book — reset is off.</p>
          )}
          <WalletChip />
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">On-chain (Azuro)</h2>
          {!isConnected ? (
            <Empty text="Connect a wallet to load live positions." />
          ) : chainBets.length === 0 ? (
            <Empty text="No Azuro bets for this wallet yet." />
          ) : (
            <ul className="mt-3 space-y-2">
              {chainBets.map((b) => (
                <li key={b.id} className="rounded-lg bg-card px-4 py-3 text-sm shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{b.title}</span>
                    <span className="shrink-0 font-mono tabular-nums">{formatUsdFull(b.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {b.state}
                    {b.result ? ` · ${b.result}` : ""}
                    {` · odds ${b.odds.toFixed(2)}`}
                    {b.payout != null ? ` · payout ${formatUsdFull(b.payout)}` : ""}
                    {b.txHash ? ` · ${b.txHash.slice(0, 10)}…` : ""}
                  </p>
                  {(b.canCashout || b.canClaim) && (
                    <div className="mt-2 flex gap-2">
                      {b.canCashout && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyBet === b.id}
                          onClick={() => void onCashout(b)}
                        >
                          {busyBet === b.id ? "Working…" : "Cash out"}
                        </Button>
                      )}
                      {b.canClaim && (
                        <Button size="sm" disabled={busyBet === b.id} onClick={() => void onClaim(b)}>
                          {busyBet === b.id ? "Working…" : "Claim"}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Positions</h2>
          {valued.length === 0 ? (
            <Empty text="No open positions. Buy Yes or No on any market." />
          ) : (
            <>
              <ul className="mt-3 space-y-2 sm:hidden">
                {valued.map((p) => (
                  <li
                    key={`${p.marketId}-${p.outcomeId}`}
                    className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]"
                  >
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
                      {formatShares(p.shares)} shares
                    </p>
                    <div className="mt-2 flex justify-between font-mono text-sm tabular-nums">
                      <span>{formatUsdFull(p.value)}</span>
                      <span className={cn(p.pnl > 0 && "text-yes", p.pnl < 0 && "text-no")}>
                        {formatSignedUsd(p.pnl)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 hidden overflow-x-auto rounded-lg bg-card shadow-[var(--shadow-border)] sm:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs tracking-wide text-muted uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Market</th>
                      <th className="px-4 py-3 font-medium">Outcome</th>
                      <th className="px-4 py-3 text-right font-medium">Shares</th>
                      <th className="px-4 py-3 text-right font-medium">Value</th>
                      <th className="px-4 py-3 text-right font-medium">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valued.map((p) => (
                      <tr key={`${p.marketId}-${p.outcomeId}`} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          {p.market ? (
                            <Link
                              to="/market/$slug"
                              params={{ slug: p.market.slug }}
                              className="line-clamp-2 font-medium hover:underline"
                            >
                              {p.market.title}
                            </Link>
                          ) : (
                            p.marketId
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {p.market?.outcomes.find((o) => o.id === p.outcomeId)?.label ?? p.outcomeId}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{formatShares(p.shares)}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{formatUsdFull(p.value)}</td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-mono tabular-nums",
                            p.pnl > 0 && "text-yes",
                            p.pnl < 0 && "text-no",
                          )}
                        >
                          {formatSignedUsd(p.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {linked && orders.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-tight">Open limits</h2>
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {orders.map((o) => {
                const m = MARKET_BY_ID[o.marketId];
                return (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium capitalize">{o.side}</span>{" "}
                      <span className="text-muted">
                        {m?.outcomes.find((x) => x.id === o.outcomeId)?.label} · {m?.title} @{" "}
                        {Math.round(o.limitPrice * 100)}¢
                      </span>
                      {o.filled && <span className="ml-2 text-yes">Filled</span>}
                    </span>
                    {!o.filled && (
                      <Button size="chip" variant="ghost" onClick={() => void onCancel(o.id)}>
                        Cancel
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {linked && parlays.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold tracking-tight">Combos</h2>
            <ul className="mt-3 space-y-2">
              {parlays.map((p) => (
                <li key={p.id} className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium capitalize">{p.status} combo</span>
                    <span className="font-mono text-sm tabular-nums">{formatUsdFull(p.stake)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Combined {(p.combinedPrice * 100).toFixed(1)}% · pays{" "}
                    {formatUsdFull(p.combinedPrice > 0 ? p.stake / p.combinedPrice : 0)}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {p.legs.map((leg, i) => {
                      const m = MARKETS.find((x) => x.id === leg.marketId);
                      return (
                        <li key={`${p.id}-${i}`}>
                          {m?.title} · {m?.outcomes.find((o) => o.id === leg.outcomeId)?.label} @{" "}
                          {Math.round(leg.price * 100)}¢
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Watchlist</h2>
          {watchlist.length === 0 ? (
            <Empty text="Bookmark a market to keep it here." />
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {watchlist.map((id) => {
                const m = MARKET_BY_ID[id];
                if (!m) return null;
                return (
                  <li key={id}>
                    <Link to="/market/$slug" params={{ slug: m.slug }} className="block px-4 py-3 text-sm hover:bg-card-2">
                      {m.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-tight">Recent trades</h2>
          {trades.length === 0 ? (
            <Empty text="Fills will land here after you trade." />
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg bg-card shadow-[var(--shadow-border)]">
              {trades.slice(0, 20).map((t) => {
                const m = MARKET_BY_ID[t.marketId];
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium capitalize">{t.action}</span>{" "}
                      <span className="text-muted">
                        {m?.outcomes.find((o) => o.id === t.outcomeId)?.label} · {m?.title}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">{formatUsdFull(t.cost)}</span>
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

function Empty({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-lg bg-card px-4 py-8 text-center text-sm text-muted shadow-[var(--shadow-border)]">
      {text}{" "}
      <Link to="/" className="font-medium text-foreground underline">
        Browse markets
      </Link>
    </p>
  );
}

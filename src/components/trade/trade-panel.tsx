import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AzuroTicket } from "@/components/trade/azuro-ticket";
import { lmsrPrices, quoteBuy, quoteSell, sharesForSpend } from "@/lib/amm";
import { useClientSession } from "@/lib/use-client-session";
import { formatShares, formatUsdFull } from "@/lib/format";
import { isBinary, MARKETS } from "@/lib/markets";
import { platformFeeBps } from "@/lib/protocol/config";
import { applyFeeBps } from "@/lib/protocol/odds";
import {
  bootstrapDesk,
  executeTrade,
  placeLimit,
  placeParlay,
} from "@/lib/server/desk";
import type { Market } from "@/lib/types";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const PRESETS = [10, 25, 50, 100];

type Tab = "market" | "limit" | "combo";

export function TradePanel({ market, initialSide }: { market: Market; initialSide?: string }) {
  if (market.venue === "azuro") {
    return <AzuroTicket market={market} initialSide={initialSide} />;
  }
  return <DeskTicket market={market} initialSide={initialSide} />;
}

function DeskTicket({ market, initialSide }: { market: Market; initialSide?: string }) {
  const binary = isBinary(market);
  const defaultOutcome =
    initialSide === "no" && binary
      ? "no"
      : initialSide && market.outcomes.some((o) => o.id === initialSide)
        ? initialSide
        : market.outcomes[0].id;
  const [tab, setTab] = useState<Tab>("market");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [outcomeId, setOutcomeId] = useState(defaultOutcome);
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const pool = useMarketStore((s) => s.pools[market.id]);
  const cash = useMarketStore((s) => s.cash);
  const linked = useMarketStore((s) => s.linked);
  const position = useMarketStore((s) =>
    s.positions.find((p) => p.marketId === market.id && p.outcomeId === outcomeId),
  );
  const buy = useMarketStore((s) => s.buy);
  const sell = useMarketStore((s) => s.sell);
  const patchAfterTrade = useMarketStore((s) => s.patchAfterTrade);
  const { user, isPending } = useClientSession();
  const feeBps = platformFeeBps();

  const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
  const usd = Number(amount) || 0;

  const buyQuote = useMemo(() => {
    if (!pool || action !== "buy" || usd <= 0) return null;
    const { net, fee } = applyFeeBps(usd, feeBps);
    const shares = sharesForSpend(pool, outcomeId, net);
    const cost = quoteBuy(pool, outcomeId, shares);
    const avg = shares > 0 ? cost / shares : 0;
    return { shares, cost, avg, payout: shares, fee };
  }, [pool, usd, action, outcomeId, feeBps]);

  const sellQuote = useMemo(() => {
    if (!pool || action !== "sell") return null;
    const shares = Math.min(position?.shares ?? 0, usd);
    if (shares <= 0) return null;
    const proceeds = quoteSell(pool, outcomeId, shares);
    return { shares, proceeds, avg: proceeds / shares };
  }, [pool, action, usd, position, outcomeId]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      if (linked) {
        const res = await executeTrade({
          data: { marketId: market.id, outcomeId, action, amount: usd },
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        patchAfterTrade({
          pool: res.pool,
          marketId: market.id,
          profile: res.profile,
          positions: res.positions,
        });
        toast.success(
          action === "buy"
            ? `Bought ${market.outcomes.find((o) => o.id === outcomeId)?.label}`
            : "Position reduced",
        );
        return;
      }
      if (action === "buy") {
        const res = buy(market.id, outcomeId, usd);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Bought ${market.outcomes.find((o) => o.id === outcomeId)?.label}`);
        return;
      }
      const res = sell(market.id, outcomeId, usd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Position reduced");
    } catch {
      toast.error("Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const outcome = market.outcomes.find((o) => o.id === outcomeId);

  return (
    <aside className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex rounded-sm bg-card-2 p-1">
        {(["market", "limit", "combo"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "h-9 flex-1 rounded-xs text-xs font-medium capitalize",
              tab === t ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted",
            )}
          >
            {t === "combo" ? "Combo" : t === "limit" ? "Limit" : "Market"}
          </button>
        ))}
      </div>

      {tab === "market" && (
        <>
          <div className="mt-4 flex rounded-sm bg-card-2 p-1">
            {(["buy", "sell"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAction(a);
                  if (a === "sell") setAmount(position ? String(Number(position.shares.toFixed(2))) : "0");
                  else setAmount("25");
                }}
                className={cn(
                  "h-9 flex-1 rounded-xs text-sm font-medium capitalize",
                  action === a ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted",
                )}
              >
                {a}
              </button>
            ))}
          </div>

          <OutcomePicker market={market} prices={prices} outcomeId={outcomeId} onPick={setOutcomeId} binary={binary} />

          <label className="mt-4 block">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">
              {action === "buy" ? "Amount (USD)" : "Shares to sell"}
            </span>
            <Input
              className="mt-1.5 font-mono tabular-nums"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </label>

          {action === "buy" && (
            <div className="mt-2 flex gap-1.5">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  className="h-8 flex-1 rounded-sm bg-card-2 text-xs font-medium text-muted hover:text-foreground"
                >
                  ${n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(cash)))}
                className="h-8 flex-1 rounded-sm bg-card-2 text-xs font-medium text-muted hover:text-foreground"
              >
                Max
              </button>
            </div>
          )}

          <dl className="mt-4 space-y-2 text-sm">
            <Row
              label="Avg price"
              value={
                action === "buy"
                  ? buyQuote
                    ? `${Math.round(buyQuote.avg * 100)}¢`
                    : "—"
                  : sellQuote
                    ? `${Math.round(sellQuote.avg * 100)}¢`
                    : "—"
              }
            />
            {action === "buy" && (
              <>
                <Row label="Shares" value={buyQuote ? formatShares(buyQuote.shares) : "—"} />
                <Row label="Payout if win" value={buyQuote ? formatUsdFull(buyQuote.payout) : "—"} />
                <Row
                  label="Platform fee"
                  value={buyQuote ? (feeBps ? formatUsdFull(buyQuote.fee) : "0%") : "—"}
                />
              </>
            )}
            {action === "sell" && (
              <Row label="You'll receive" value={sellQuote ? formatUsdFull(sellQuote.proceeds) : "—"} />
            )}
            <Row label="Cash" value={formatUsdFull(cash)} />
            {position && <Row label="Your shares" value={formatShares(position.shares)} />}
          </dl>

          <Button
            className="mt-4 w-full"
            variant={outcomeId === "no" ? "no" : outcomeId === "yes" ? "yes" : "default"}
            onClick={() => void submit()}
            disabled={usd <= 0 || busy}
          >
            {busy ? "Working…" : action === "buy" ? "Buy" : "Sell"} {outcome?.short ?? outcome?.label}
          </Button>
          <p className="mt-3 text-center text-[11px] text-subtle">
            {linked ? "Shared desk · paper USDC" : "Local paper · sign in to join the shared book"}
            {feeBps ? ` · ${feeBps} bps fee` : " · 0% extra fee"}
          </p>
        </>
      )}

      {tab === "limit" && (
        <LimitTicket
          market={market}
          prices={prices}
          outcomeId={outcomeId}
          setOutcomeId={setOutcomeId}
          binary={binary}
          cash={cash}
          isPending={isPending}
          signedIn={Boolean(user)}
          displayName={user?.displayName}
        />
      )}

      {tab === "combo" && (
        <ComboTicket
          market={market}
          cash={cash}
          isPending={isPending}
          signedIn={Boolean(user)}
          displayName={user?.displayName}
        />
      )}
    </aside>
  );
}

function OutcomePicker({
  market,
  prices,
  outcomeId,
  onPick,
  binary,
}: {
  market: Market;
  prices: Record<string, number>;
  outcomeId: string;
  onPick: (id: string) => void;
  binary: boolean;
}) {
  return (
    <div className={cn("mt-4 grid gap-2", binary ? "grid-cols-2" : "grid-cols-1")}>
      {market.outcomes.map((o) => {
        const p = prices[o.id] ?? 0;
        const active = o.id === outcomeId;
        const tone = o.id === "yes" ? "yes" : o.id === "no" ? "no" : "neutral";
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={cn(
              "flex h-12 items-center justify-between rounded-sm px-3 text-sm font-medium transition-colors",
              tone === "yes" && (active ? "bg-yes text-yes-fg" : "bg-yes-soft text-yes"),
              tone === "no" && (active ? "bg-no text-no-fg" : "bg-no-soft text-no"),
              tone === "neutral" && (active ? "bg-primary text-primary-fg" : "bg-card-2 text-foreground"),
            )}
          >
            <span>{o.short ?? o.label}</span>
            <span className="font-mono tabular-nums">{Math.round(p * 100)}¢</span>
          </button>
        );
      })}
    </div>
  );
}

function LimitTicket({
  market,
  prices,
  outcomeId,
  setOutcomeId,
  binary,
  cash,
  isPending,
  signedIn,
  displayName,
}: {
  market: Market;
  prices: Record<string, number>;
  outcomeId: string;
  setOutcomeId: (id: string) => void;
  binary: boolean;
  cash: number;
  isPending: boolean;
  signedIn: boolean;
  displayName: string | null | undefined;
}) {
  const applySnapshot = useMarketStore((s) => s.applySnapshot);
  const px = prices[outcomeId] ?? 0.5;
  const [limit, setLimit] = useState(String(Math.round(px * 100)));
  const [amount, setAmount] = useState("50");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [busy, setBusy] = useState(false);

  if (isPending) return <div className="mt-4 h-32 animate-pulse rounded-sm bg-card-2" />;
  if (!signedIn) return <AccountHint feature="Limit orders rest on the shared book." />;

  async function rest() {
    const limitPrice = Number(limit) / 100;
    const usd = Number(amount) || 0;
    if (busy) return;
    setBusy(true);
    try {
      const res = await placeLimit({
        data: { marketId: market.id, outcomeId, side, limitPrice, amount: usd },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const snap = await bootstrapDesk({ data: { displayName: displayName ?? null } });
      applySnapshot(snap);
      toast.success("Limit resting");
    } catch {
      toast.error("Could not rest limit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex rounded-sm bg-card-2 p-1">
        {(["buy", "sell"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setSide(a)}
            className={cn(
              "h-9 flex-1 rounded-xs text-sm font-medium capitalize",
              side === a ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted",
            )}
          >
            {a}
          </button>
        ))}
      </div>
      <OutcomePicker market={market} prices={prices} outcomeId={outcomeId} onPick={setOutcomeId} binary={binary} />
      <label className="mt-4 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Limit (cents)</span>
        <Input
          className="mt-1.5 font-mono tabular-nums"
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>
      <label className="mt-4 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Amount</span>
        <Input
          className="mt-1.5 font-mono tabular-nums"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>
      <p className="mt-2 text-xs text-subtle">Cash {formatUsdFull(cash)}</p>
      <Button className="mt-4 w-full" onClick={() => void rest()} disabled={busy}>
        {busy ? "Working…" : "Rest limit"}
      </Button>
    </>
  );
}

function ComboTicket({
  market,
  cash,
  isPending,
  signedIn,
  displayName,
}: {
  market: Market;
  cash: number;
  isPending: boolean;
  signedIn: boolean;
  displayName: string | null | undefined;
}) {
  const applySnapshot = useMarketStore((s) => s.applySnapshot);
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const others = MARKETS.filter((m) => m.id !== market.id).slice(0, 8);
  const [leg, setLeg] = useState(others[0]?.id ?? "");
  const legOut = "yes";

  if (isPending) return <div className="mt-4 h-32 animate-pulse rounded-sm bg-card-2" />;
  if (!signedIn) return <AccountHint feature="Combos lock on the shared book." />;

  async function lock() {
    const usd = Number(amount) || 0;
    if (busy) return;
    setBusy(true);
    try {
      const m = MARKETS.find((x) => x.id === leg);
      const res = await placeParlay({
        data: {
          stake: usd,
          legs: [
            { marketId: market.id, outcomeId: market.outcomes[0].id },
            { marketId: leg, outcomeId: m?.outcomes.some((o) => o.id === legOut) ? legOut : m?.outcomes[0].id ?? "yes" },
          ],
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const snap = await bootstrapDesk({ data: { displayName: displayName ?? null } });
      applySnapshot(snap);
      toast.success("Combo locked");
    } catch {
      toast.error("Could not lock combo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="mt-4 text-xs text-muted">This market + one more leg.</p>
      <label className="mt-3 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Second leg</span>
        <select
          className="mt-1.5 h-10 w-full rounded-sm bg-card-2 px-3 text-sm"
          value={leg}
          onChange={(e) => setLeg(e.target.value)}
        >
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Stake</span>
        <Input
          className="mt-1.5 font-mono tabular-nums"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>
      <p className="mt-2 text-xs text-subtle">Cash {formatUsdFull(cash)}</p>
      <Button className="mt-4 w-full" onClick={() => void lock()} disabled={busy}>
        {busy ? "Working…" : "Lock combo"}
      </Button>
    </>
  );
}

function AccountHint({ feature }: { feature: string }) {
  return (
    <p className="mt-4 rounded-sm bg-card-2 px-3 py-4 text-center text-sm text-muted">
      {feature}{" "}
      <Link to="/login" className="text-foreground underline underline-offset-2">
        Sign in
      </Link>
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}

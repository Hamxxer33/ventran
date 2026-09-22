import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { polygon } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletChip } from "@/components/wallet/connect";
import { formatUsdFull } from "@/lib/format";
import { azuroChainId } from "@/lib/protocol/config";
import { placeAzuroBet, type PlaceProgress } from "@/lib/protocol/azuro-trade";
import { quoteLiveBet, type LiveQuote } from "@/lib/server/live";
import type { Market } from "@/lib/types";
import { ERC20_ABI } from "@/lib/wallet/config";
import { cn } from "@/lib/utils";

const PRESETS = [10, 25, 50, 100];

export function AzuroTicket({ market, initialSide }: { market: Market; initialSide?: string }) {
  const defaultOutcome =
    initialSide && market.outcomes.some((o) => o.id === initialSide)
      ? initialSide
      : market.outcomes[0]?.id;
  const [outcomeId, setOutcomeId] = useState(defaultOutcome ?? "");
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PlaceProgress | null>(null);
  const [quote, setQuote] = useState<Extract<LiveQuote, { ok: true }> | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChain } = useSwitchChain();
  const need = azuroChainId();
  const usd = Number(amount) || 0;
  const prices = market.seed;
  const odds = market.odds?.[outcomeId];
  const closed = market.status === "paused" || market.status === "resolved" || market.status === "canceled";

  const [bal, setBal] = useState<string | null>(null);
  useEffect(() => {
    if (!address || !quote || !publicClient) {
      setBal(null);
      return;
    }
    let cancelled = false;
    void publicClient
      .readContract({
        address: quote.token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address],
      })
      .then((raw) => {
        if (!cancelled) setBal(formatUnits(raw as bigint, quote.decimals));
      })
      .catch(() => {
        if (!cancelled) setBal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address, quote, publicClient]);

  useEffect(() => {
    if (usd <= 0 || closed) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void quoteLiveBet({
        data: { marketId: market.id, outcomeId, amount: usd, account: address },
      }).then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setQuote(null);
          setQuoteErr(res.error);
          return;
        }
        setQuoteErr(null);
        setQuote(res);
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [market.id, outcomeId, usd, address, closed]);

  const progressLabel = useMemo(() => {
    if (!progress) return null;
    switch (progress.step) {
      case "network":
        return "Switch network";
      case "approve":
        return progress.hash ? "Approval confirming…" : "Approve spending";
      case "fee":
        return progress.hash ? "Fee confirming…" : "Paying platform fee";
      case "sign":
        return "Sign the bet";
      case "submit":
        return "Submitting order";
      case "confirm":
        return progress.txHash ? "On-chain…" : "Waiting for relayer";
      case "done":
        return "Filled";
      case "error":
        return progress.error;
      default:
        return "Working…";
    }
  }, [progress]);

  async function submit() {
    if (busy || closed) return;
    if (!isConnected || !address) {
      toast.error("Connect a wallet to trade on-chain.");
      return;
    }
    if (chainId !== need) {
      switchChain({ chainId: need === 137 ? polygon.id : need });
      toast.message("Switch to Polygon to trade this book.");
      return;
    }
    if (!wallet || !publicClient || !quote) {
      toast.error(quoteErr || "Quote unavailable.");
      return;
    }
    setBusy(true);
    setProgress({ step: "quote" });
    try {
      const fresh = await quoteLiveBet({
        data: { marketId: market.id, outcomeId, amount: usd, account: address },
      });
      if (!fresh.ok) {
        toast.error(fresh.error);
        return;
      }
      setQuote(fresh);
      const res = await placeAzuroBet({
        wallet,
        account: address,
        chainId,
        quote: fresh,
        amount: usd,
        marketId: market.id,
        outcomeId,
        publicClient: publicClient as unknown as Parameters<typeof placeAzuroBet>[0]["publicClient"],
        onProgress: setProgress,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.txHash ? `Filled · ${res.txHash.slice(0, 10)}…` : "Order accepted");
    } finally {
      setBusy(false);
    }
  }

  const outcome = market.outcomes.find((o) => o.id === outcomeId);

  return (
    <aside className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          {market.status === "live" ? "Live" : "Market"} · Azuro
        </p>
        <WalletChip />
      </div>

      <div className="mt-4 grid gap-2">
        {market.outcomes.map((o) => {
          const p = prices[o.id] ?? 0;
          const active = o.id === outcomeId;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOutcomeId(o.id)}
              className={cn(
                "flex h-12 items-center justify-between rounded-sm px-3 text-sm font-medium",
                active ? "bg-primary text-primary-fg" : "bg-card-2 text-foreground",
              )}
            >
              <span className="truncate pr-2">{o.short ?? o.label}</span>
              <span className="font-mono tabular-nums">
                {market.odds?.[o.id] ? market.odds[o.id]!.toFixed(2) : `${Math.round(p * 100)}¢`}
              </span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Amount (USDT)</span>
        <Input
          className="mt-1.5 font-mono tabular-nums"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          disabled={closed}
        />
      </label>
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
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <Row label="Odds" value={odds ? odds.toFixed(2) : "—"} />
        <Row label="Est. payout" value={quote ? formatUsdFull(quote.payout) : "—"} />
        <Row label="Profit if win" value={quote ? formatUsdFull(quote.profit) : "—"} />
        <Row
          label="Relayer fee"
          value={quote ? `${quote.relayerFee.toFixed(4)} ${quote.tokenSymbol}` : "—"}
        />
        <Row
          label="Platform fee"
          value={
            quote
              ? quote.platformFeeBps
                ? `${formatUsdFull(quote.platformFee)} (${quote.platformFeeBps} bps)`
                : "0% · affiliate only"
              : "—"
          }
        />
        <Row label="Wallet" value={bal != null ? `${Number(bal).toFixed(2)} USDT` : isConnected ? "…" : "Connect"} />
      </dl>

      {closed && (
        <p className="mt-3 text-center text-xs text-muted">
          {market.status === "paused" ? "Market paused" : "Market closed"}
        </p>
      )}
      {quoteErr && !closed && <p className="mt-3 text-center text-xs text-no">{quoteErr}</p>}
      {progressLabel && busy && <p className="mt-3 text-center text-xs text-muted">{progressLabel}</p>}

      <Button className="mt-4 w-full" onClick={() => void submit()} disabled={usd <= 0 || busy || closed}>
        {busy ? progressLabel ?? "Working…" : `Buy ${outcome?.short ?? outcome?.label ?? ""}`}
      </Button>
      <p className="mt-3 text-center text-[11px] text-subtle">
        Settles in USDT on Polygon via Azuro. Odds include protocol margin. This app does not resolve the event.
        {progress && progress.step === "done" && "txHash" in progress && progress.txHash
          ? ` Tx ${progress.txHash.slice(0, 10)}…`
          : ""}
      </p>
    </aside>
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

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { PERPS, PERP_ROUND_MS, roundStart, type PerpMeta } from "@/lib/catalog";
import { usePerpStore, upPrice } from "@/lib/perp-store";
import { cn } from "@/lib/utils";

export function LiveCard({ perp }: { perp: PerpMeta }) {
  const [now, setNow] = useState<number | null>(null);
  const [watched, setWatched] = useState(false);
  const buy = usePerpStore((s) => s.buy);
  const settle = usePerpStore((s) => s.settle);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      settle(t);
    }, 250);
    return () => window.clearInterval(id);
  }, [settle]);

  const start = now ? roundStart(now) : 0;
  const remain = now ? Math.max(0, start + PERP_ROUND_MS - now) : PERP_ROUND_MS;
  const up = now ? upPrice(perp.id, start, now, perp.seed) : perp.seed;
  const down = 1 - up;
  const mm = String(Math.floor(remain / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remain % 60000) / 1000)).padStart(2, "0");

  function take(side: "up" | "down", stake: number) {
    const t = Date.now();
    const res = buy(perp.id, side, stake, t);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${side === "up" ? "Up" : "Down"} ${perp.symbol} · $${stake}`);
  }

  const profit = (stake: number, p: number) => Math.round(stake / p - stake);

  return (
    <article className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <PerpBadge symbol={perp.symbol} />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-sm leading-snug font-medium tracking-tight">
            {perp.symbol} Up or Down 5m
          </h3>
        </div>
        <ChanceRing value={up} />
      </div>

      <div className="mt-3 flex gap-2">
        <div className="flex min-h-12 flex-1 overflow-hidden rounded-md bg-yes text-yes-fg">
          <div className="flex flex-col justify-center py-1">
            <button
              type="button"
              onClick={() => take("up", 10)}
              className="px-3 py-0.5 text-left text-xs font-semibold tabular-nums"
            >
              +${profit(10, up)}
            </button>
            <button
              type="button"
              onClick={() => take("up", 25)}
              className="px-3 py-0.5 text-left text-xs font-semibold tabular-nums"
            >
              +${profit(25, up)}
            </button>
          </div>
          <button
            type="button"
            onClick={() => take("up", 10)}
            className="flex flex-1 items-center justify-center text-sm font-semibold"
          >
            Up
          </button>
        </div>
        <button
          type="button"
          onClick={() => take("down", 10)}
          className="flex min-h-12 flex-1 items-center justify-between rounded-md bg-no px-4 text-no-fg"
        >
          <span className="text-sm font-semibold">Down</span>
          <span className="text-xs font-semibold tabular-nums">+${profit(10, down)}</span>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block size-1.5 rounded-full bg-no" />
          <span className="font-medium tracking-wide">LIVE</span>
          <span className="text-subtle">· {perp.name}</span>
          <span className="font-mono tabular-nums text-subtle">{now ? `${mm}:${ss}` : "--:--"}</span>
        </p>
        <button
          type="button"
          aria-label={watched ? "Remove bookmark" : "Bookmark"}
          onClick={() => setWatched((v) => !v)}
          className={cn("rounded-sm p-1.5 text-subtle hover:text-foreground", watched && "text-foreground")}
        >
          <Bookmark className={cn("size-4", watched && "fill-foreground")} />
        </button>
      </div>
    </article>
  );
}

function PerpBadge({ symbol }: { symbol: string }) {
  return (
    <div
      className="grid size-12 shrink-0 place-items-center rounded-md bg-card-2 text-[13px] font-semibold tracking-tight"
      aria-hidden="true"
    >
      {symbol}
    </div>
  );
}

function ChanceRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0.01, value) * c;
  return (
    <svg viewBox="0 0 72 72" className="size-16 shrink-0" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" className="stroke-card-2" strokeWidth="7" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        className="stroke-yes"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="34"
        textAnchor="middle"
        className="fill-foreground"
        fontSize="13"
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
        fontWeight="500"
      >
        {Math.round(value * 100)}%
      </text>
      <text x="36" y="46" textAnchor="middle" className="fill-muted" fontSize="8">
        Up
      </text>
    </svg>
  );
}

export function LiveStrip() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {PERPS.map((p) => (
        <div key={p.id} className="w-72 max-w-[calc(100vw-2rem)] shrink-0">
          <LiveCard perp={p} />
        </div>
      ))}
    </div>
  );
}

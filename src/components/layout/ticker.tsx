import { TICKER_ITEMS } from "@/lib/markets";

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="relative overflow-hidden border-b border-border bg-foreground text-background">
      <div className="ticker-track flex w-max gap-10 py-2 pr-10 text-[11px] font-medium tracking-wide uppercase">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="shrink-0">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

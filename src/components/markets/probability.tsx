import { formatPct, percentWidth } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Chance({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        size === "sm" && "text-sm",
        size === "md" && "text-xl tracking-tight",
        size === "lg" && "text-4xl tracking-tight",
      )}
    >
      {formatPct(value)}
    </span>
  );
}

export function SplitBar({ yes }: { yes: number }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-no/20">
      <div className="h-full bg-yes" style={{ width: percentWidth(yes) }} />
      <div className="h-full flex-1 bg-no" />
    </div>
  );
}

export function OutcomeRow({
  label,
  price,
  tone = "neutral",
}: {
  label: string;
  price: number;
  tone?: "yes" | "no" | "neutral";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-card-2">
        <div
          className={cn("h-full rounded-full", tone === "no" ? "bg-no" : "bg-yes")}
          style={{ width: percentWidth(price) }}
        />
      </div>
      <span
        className={cn(
          "w-10 text-right text-sm font-medium tabular-nums",
          tone === "yes" && "text-yes",
          tone === "no" && "text-no",
        )}
      >
        {formatPct(price)}
      </span>
    </div>
  );
}

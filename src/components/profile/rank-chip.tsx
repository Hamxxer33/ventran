import { rankForXp, rankProgress } from "@/lib/ranks";
import { cn } from "@/lib/utils";

export function RankChip({ xp, className }: { xp: number; className?: string }) {
  const rank = rankForXp(xp);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-card-2 px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted",
        className,
      )}
    >
      <span className="text-foreground">{rank.name}</span>
      <span className="font-mono tabular-nums">Lv {rank.level}</span>
    </span>
  );
}

export function RankBar({ xp }: { xp: number }) {
  const rank = rankForXp(xp);
  const pct = Math.round(rankProgress(xp) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {rank.name} · {xp} XP
        </span>
        <span className="font-mono tabular-nums">{rank.next ? `${rank.next} next` : "Max"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card-2">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

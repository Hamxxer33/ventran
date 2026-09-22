import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPct } from "@/lib/format";
import type { PricePoint } from "@/lib/types";

export function ProbabilityChart({ data }: { data: PricePoint[] }) {
  const last = data[data.length - 1]?.p ?? 0;
  const first = data[0]?.p ?? last;
  const up = last >= first;
  const stroke = up ? "#1A7A4C" : "#C23B2E";
  const fillId = up ? "yesFill" : "noFill";

  return (
    <div className="h-56 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="yesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1A7A4C" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#1A7A4C" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="noFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C23B2E" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#C23B2E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 1]} hide />
          <Tooltip
            cursor={{ stroke: "#111110", strokeOpacity: 0.15 }}
            content={({ payload }) => {
              const point = payload?.[0]?.payload as PricePoint | undefined;
              if (!point) return null;
              return (
                <div className="rounded-sm bg-foreground px-2.5 py-1.5 text-xs text-background">
                  <div className="font-mono tabular-nums">{formatPct(point.p, 1)}</div>
                  <div className="opacity-70">
                    {new Date(point.t).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="p"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

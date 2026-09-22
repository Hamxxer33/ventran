import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Layers, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  { to: "/", label: "Trending", icon: TrendingUp, match: (p: string) => p === "/" },
  { to: "/combos", label: "Combos", icon: Layers, match: (p: string) => p.startsWith("/combos") },
  { to: "/perps", label: "Perps", icon: Activity, match: (p: string) => p.startsWith("/perps") },
  { to: "/breaking", label: "Breaking", icon: Zap, match: (p: string) => p.startsWith("/breaking") },
] as const;

export function ModeBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="border-b border-border">
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
        {MODES.map((m) => {
          const active = m.match(path);
          const Icon = m.icon;
          return (
            <Link
              key={m.to}
              to={m.to}
              className={cn(
                "relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-medium",
                active ? "text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {m.label}
              {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

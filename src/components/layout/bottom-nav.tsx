import { Link, useRouterState } from "@tanstack/react-router";
import { House, Menu, Search, Zap } from "lucide-react";
import { MoreSheet } from "./more-sheet";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex h-14 max-w-lg items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        <Tab to="/" icon={House} label="Home" active={path === "/"} />
        <Tab to="/search" icon={Search} label="Search" active={path.startsWith("/search")} />
        <Tab to="/breaking" icon={Zap} label="Breaking" active={path.startsWith("/breaking")} />
        <MoreSheet>
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
          >
            <Menu className="size-5" />
            More
          </button>
        </MoreSheet>
      </div>
    </nav>
  );
}

function Tab({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: "/" | "/search" | "/breaking";
  icon: typeof House;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
        active ? "text-foreground" : "text-muted",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

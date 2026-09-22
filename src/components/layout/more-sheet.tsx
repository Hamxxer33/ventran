import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CircleDollarSign,
  Code2,
  HelpCircle,
  Moon,
  ScrollText,
  Sun,
  Target,
  Trophy,
  Activity,
  User,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserButton } from "@/lib/auth/gates";
import { useClientSession } from "@/lib/use-client-session";
import { useTheme } from "@/lib/theme";
import { computeDeskPnl } from "@/lib/pnl";
import { formatSignedUsd } from "@/lib/format";
import { hueFromId } from "@/lib/ranks";
import { TraderAvatar } from "@/components/profile/avatar";
import { useMarketStore } from "@/lib/store";
import { usePerpStore } from "@/lib/perp-store";
import { WalletChip } from "@/components/wallet/connect";
import { cn } from "@/lib/utils";

export function MoreSheet({ children }: { children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="left" className="flex flex-col overflow-y-auto p-0">
        <MoreBody />
      </SheetContent>
    </Sheet>
  );
}

function MoreBody() {
  const { user, isPending } = useClientSession();
  const { theme, toggle } = useTheme();
  const handle = useMarketStore((s) => s.handle);
  const cash = useMarketStore((s) => s.cash);
  const deposited = useMarketStore((s) => s.deposited);
  const positions = useMarketStore((s) => s.positions);
  const pools = useMarketStore((s) => s.pools);
  const parlays = useMarketStore((s) => s.parlays);
  const perpPositions = usePerpStore((s) => s.positions);
  const pnl = computeDeskPnl({
    cash,
    deposited,
    positions,
    pools,
    perpPositions,
    parlays,
    now: Date.now(),
  });
  const name = handle ?? "trader";
  return (
    <div className="flex min-h-full flex-col px-5 pt-14 pb-8">
      <Link
        to="/profile"
        className="mb-4 flex items-center gap-3 rounded-md px-1 py-2 hover:bg-card-2"
      >
        <TraderAvatar handle={name} hue={hueFromId(user?.id ?? name)} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">@{name}</span>
          <span className="mt-0.5 flex gap-3 text-xs text-muted">
            <span>
              Realized{" "}
              <span className={cn("font-mono tabular-nums", pnl.realized >= 0 ? "text-yes" : "text-no")}>
                {formatSignedUsd(pnl.realized)}
              </span>
            </span>
            <span>
              Unreal.{" "}
              <span className={cn("font-mono tabular-nums", pnl.unrealized >= 0 ? "text-yes" : "text-no")}>
                {formatSignedUsd(pnl.unrealized)}
              </span>
            </span>
          </span>
        </span>
      </Link>
      <div className="mb-4">
        <WalletChip />
      </div>
      <nav className="space-y-1">
        <MoreLink to="/profile" icon={User} label="Profile" />
        <MoreLink to="/leaders" icon={Trophy} label="Leaderboard" />
        <MoreLink to="/rewards" icon={CircleDollarSign} label="Rewards" tone="yes" />
        <MoreLink to="/help" icon={Code2} label="APIs" hash="apis" />
      </nav>
      <hr className="my-4 border-border" />
      <nav className="space-y-0.5">
        <MoreLink to="/help" icon={Target} label="Accuracy" hash="accuracy" quiet />
        <MoreLink to="/help" icon={Activity} label="Status" hash="status" quiet />
        <MoreLink to="/help" icon={BookOpen} label="Documentation" hash="docs" quiet />
        <MoreLink to="/help" icon={HelpCircle} label="Help Center" hash="help" quiet />
        <MoreLink to="/help" icon={ScrollText} label="Terms of Use" hash="terms" quiet />
      </nav>
      <div className="mt-2 flex h-11 items-center justify-between px-1 text-sm">
        <span className="flex items-center gap-3 text-foreground">
          <UsFlag />
          Language
        </span>
        <span className="text-muted">English</span>
      </div>
      <div className="mt-3 flex items-center gap-1 px-1">
        <a
          href="https://x.com/Ventranxyz"
          target="_blank"
          rel="noreferrer"
          aria-label="Ventran on X"
          className="inline-flex size-10 items-center justify-center rounded-sm hover:bg-card-2"
        >
          <XMark />
        </a>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex size-10 items-center justify-center rounded-sm hover:bg-card-2"
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
      </div>
      <div className="mt-auto pt-6">
        {isPending ? (
          <div className="h-11 animate-pulse rounded-sm bg-card-2" />
        ) : user ? (
          <UserButton />
        ) : (
          <div className="grid gap-2">
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-full text-sm font-medium shadow-[var(--shadow-border)]"
            >
              Log in
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-fg"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function MoreLink({
  to,
  icon: Icon,
  label,
  hash,
  quiet,
  tone,
}: {
  to: "/leaders" | "/rewards" | "/help" | "/profile";
  icon: typeof Trophy;
  label: string;
  hash?: string;
  quiet?: boolean;
  tone?: "yes";
}) {
  return (
    <Link
      to={to}
      hash={hash}
      className={cn(
        "flex h-11 items-center gap-3 rounded-sm px-1 text-sm font-medium hover:bg-card-2",
        quiet && "font-normal",
      )}
    >
      <Icon className={cn("size-4", tone === "yes" ? "text-yes" : "text-muted")} />
      {label}
    </Link>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M17.2 3H20l-6.16 7.04L21 21h-5.5l-4.3-6.12L6.2 21H3.4l6.6-7.54L3 3h5.6l3.9 5.64L17.2 3Zm-1 16.2h1.54L8 4.7H6.34l9.86 14.5Z" />
    </svg>
  );
}

function UsFlag() {
  return (
    <svg viewBox="0 0 16 12" className="size-4 shrink-0 rounded-xs" aria-hidden="true">
      <rect width="16" height="12" fill="currentColor" className="text-no" />
      <rect y="1.3" width="16" height="1.3" className="fill-background" />
      <rect y="3.9" width="16" height="1.3" className="fill-background" />
      <rect y="6.5" width="16" height="1.3" className="fill-background" />
      <rect y="9.1" width="16" height="1.3" className="fill-background" />
      <rect width="7" height="6.5" className="fill-foreground" />
    </svg>
  );
}

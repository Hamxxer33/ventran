import { Link, useNavigate } from "@tanstack/react-router";
import { Search, Trophy, Wallet, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { VentranWordmark } from "@/components/logo";
import { RankChip } from "@/components/profile/rank-chip";
import { MoreSheet } from "@/components/layout/more-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WelcomeSheet } from "@/components/auth/welcome";
import { WalletChip } from "@/components/wallet/connect";
import { UserButton } from "@/lib/auth/gates";
import { useClientSession } from "@/lib/use-client-session";
import { formatUsdFull } from "@/lib/format";
import { mergeFeedMarkets, TOPICS } from "@/lib/catalog";
import { CATEGORY_LABEL } from "@/lib/markets";
import { useLiveStore } from "@/lib/live-store";
import { depositCash } from "@/lib/server/desk";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Header({
  category: _category,
  onCategory: _onCategory,
}: {
  category?: string;
  onCategory?: (c: string) => void;
}) {
  const cash = useMarketStore((s) => s.cash);
  const deposit = useMarketStore((s) => s.deposit);
  const linked = useMarketStore((s) => s.linked);
  const patchProfile = useMarketStore((s) => s.patchProfile);
  const handle = useMarketStore((s) => s.handle);
  const xp = useMarketStore((s) => s.xp);
  const live = useLiveStore((s) => s.markets);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return mergeFeedMarkets(live)
      .filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.tags.some((t) => t.includes(q)) ||
          CATEGORY_LABEL[m.category]?.toLowerCase().includes(q) ||
          (m.eventTitle?.toLowerCase().includes(q) ?? false) ||
          (m.leagueName?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 6);
  }, [query, live]);

  function go(slug: string) {
    setQuery("");
    setOpen(false);
    void navigate({ to: "/market/$slug", params: { slug } });
  }

  async function onDeposit() {
    if (busy) return;
    setBusy(true);
    try {
      if (linked) {
        const profile = await depositCash({ data: 2500 });
        patchProfile(profile);
      } else {
        deposit(2500);
      }
      toast.success("Deposited $2,500 paper USDC");
    } catch {
      toast.error("Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl min-w-0 items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
        <Link to="/" className="shrink-0" aria-label="Ventran home">
          <VentranWordmark />
        </Link>

        <div className="relative mx-auto hidden min-w-0 flex-1 md:block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search markets"
            className="h-10 bg-card-2 pl-9 shadow-none"
            aria-label="Search markets"
          />
          {open && results.length > 0 && (
            <div className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-md bg-card shadow-[var(--shadow-border-hover)]">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => go(m.slug)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-card-2"
                >
                  <img src={m.image} alt="" className="size-9 rounded-xs object-cover" />
                  <span className="line-clamp-1 font-medium">{m.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <HowItWorks />
          <Link
            to="/leaders"
            className="hidden items-center gap-1.5 rounded-sm px-2 py-2 text-sm font-medium text-muted hover:bg-card-2 hover:text-foreground lg:inline-flex"
          >
            <Trophy className="size-4" />
            Leaders
          </Link>
          <Link
            to="/feed"
            className="hidden items-center gap-1.5 rounded-sm px-2 py-2 text-sm font-medium text-muted hover:bg-card-2 hover:text-foreground xl:inline-flex"
          >
            <Radio className="size-4" />
            Tape
          </Link>
          <Link
            to="/portfolio"
            className="hidden items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-foreground hover:bg-card-2 sm:inline-flex"
          >
            <Wallet className="size-4" />
            <span className="font-mono text-[13px] tabular-nums">{formatUsdFull(cash)}</span>
          </Link>
          <WalletChip className="hidden lg:inline-flex" />
          <Button size="sm" onClick={() => void onDeposit()} disabled={busy} className="hidden sm:inline-flex">
            Deposit
          </Button>
          <div>
            <AuthSlot handle={handle} xp={xp} />
          </div>
          <MoreSheet>
            <Button variant="ghost" size="sm" className="hidden md:inline-flex">
              More
            </Button>
          </MoreSheet>
        </nav>
      </div>
    </header>
  );
}

function AuthSlot({ handle, xp }: { handle: string | null; xp: number }) {
  const { user, isPending } = useClientSession();
  if (isPending) {
    return <div className="h-9 w-24 animate-pulse rounded-sm bg-card-2" />;
  }
  if (!user) {
    return (
      <WelcomeSheet>
        <Button size="sm">Sign up</Button>
      </WelcomeSheet>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {handle && (
        <Link
          to="/u/$handle"
          params={{ handle }}
          className="hidden items-center gap-2 rounded-sm px-2 py-1 hover:bg-card-2 xl:inline-flex"
        >
          <RankChip xp={xp} />
        </Link>
      )}
      <UserButton />
    </div>
  );
}

function HowItWorks() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden text-muted lg:inline-flex">
          How it works
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>How Ventran works</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-3">
            <p>
              Sports prices come from Azuro’s live book. Connect a wallet, approve USDT, and sign
              the bet — the relayer posts it on-chain. This app does not pick winners.
            </p>
            <p>
              $VENTRA, politics, and crypto rows on the desk are still paper USDC until those
              markets exist on a live Arbitrum venue. Sign in to share that book.
            </p>
            <p>
              Prices are probabilities. If Yes trades at 72¢, the market implies a 72% chance.
            </p>
            <p className="text-foreground">
              Built for{" "}
              <a
                href="https://x.com/Ventranxyz"
                className="underline decoration-border-strong underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                @Ventranxyz
              </a>
              . Trade what’s next.
            </p>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

export function TopicBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-sm",
              value === t.id ? "bg-foreground text-background" : "text-muted hover:bg-card-2 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

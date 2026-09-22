import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TopicBar } from "@/components/layout/header";
import { EventCard } from "@/components/markets/event-card";
import { LiveCard } from "@/components/markets/live-card";
import { LiveGameCard, LiveGameCardSkeleton } from "@/components/markets/live-game-card";
import { MarketCard } from "@/components/markets/market-card";
import { Input } from "@/components/ui/input";
import { composeHomeFeed, marketsForTopic, mergeFeedMarkets, toFeed } from "@/lib/catalog";
import { useLiveStore } from "@/lib/live-store";
import { useMarketStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState<"volume" | "ending" | "new">("volume");
  const [query, setQuery] = useState("");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pools = useMarketStore((s) => s.pools);
  const watchlist = useMarketStore((s) => s.watchlist);
  const live = useLiveStore((s) => s.markets);
  const liveStatus = useLiveStore((s) => s.status);
  const liveError = useLiveStore((s) => s.error);

  const list = useMemo(() => {
    let rows = marketsForTopic(topic, mergeFeedMarkets(live));
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.tags.some((t) => t.includes(q)) ||
          (m.eventTitle?.toLowerCase().includes(q) ?? false) ||
          (m.topics ?? []).some((t) => t.includes(q)) ||
          (m.leagueName?.toLowerCase().includes(q) ?? false),
      );
    }
    if (watchedOnly) {
      rows = rows.filter((m) => watchlist.includes(m.id) || (m.eventId ? watchlist.includes(m.eventId) : false));
    }
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort === "new") return Number(Boolean(b.isNew)) - Number(Boolean(a.isNew));
      if (sort === "ending") return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      const va = pools[a.id]?.volume ?? a.seedVolume;
      const vb = pools[b.id]?.volume ?? b.seedVolume;
      return vb - va;
    });
    const feed = toFeed(copy);
    if (q || watchedOnly) return feed;
    return composeHomeFeed(feed, topic, live);
  }, [topic, sort, pools, query, watchedOnly, watchlist, live]);

  return (
    <AppShell>
      <div className="border-b border-border md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-10 bg-card-2 pl-9 shadow-none"
              aria-label="Search markets"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Filters"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-sm text-muted hover:bg-card-2 hover:text-foreground",
                filtersOpen && "bg-card-2 text-foreground",
              )}
            >
              <SlidersHorizontal className="size-4" />
            </button>
            {filtersOpen && (
              <div className="absolute top-11 right-0 z-30 w-40 overflow-hidden rounded-md bg-card py-1 shadow-[var(--shadow-border-hover)]">
                {(
                  [
                    ["volume", "Volume"],
                    ["ending", "Ending soon"],
                    ["new", "Newest"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSort(id);
                      setFiltersOpen(false);
                    }}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm",
                      sort === id ? "bg-card-2 font-medium" : "text-muted hover:bg-card-2 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Watchlist"
            onClick={() => setWatchedOnly((v) => !v)}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-sm text-muted hover:bg-card-2 hover:text-foreground",
              watchedOnly && "text-foreground",
            )}
          >
            <Bookmark className={cn("size-4", watchedOnly && "fill-foreground")} />
          </button>
        </div>
      </div>
      <TopicBar value={topic} onChange={setTopic} />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        {liveError && live.length === 0 && (
          <p className="mb-3 rounded-md bg-card px-3 py-2 text-xs text-muted shadow-[var(--shadow-border)]">
            Live sports feed is unreachable. Desk markets below are still on the paper book.
          </p>
        )}
        <div className="mb-4 hidden items-center justify-end md:flex">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-10 rounded-sm bg-card px-3 text-sm text-foreground shadow-[var(--shadow-border)] outline-none"
            >
              <option value="volume">Volume</option>
              <option value="ending">Ending soon</option>
              <option value="new">Newest</option>
            </select>
          </label>
        </div>
        {list.length === 0 ? (
          <p className="rounded-lg bg-card px-4 py-10 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            {watchedOnly
              ? "Nothing on your watchlist yet."
              : liveStatus === "loading"
                ? "Loading markets…"
                : "No markets in this topic yet."}
          </p>
        ) : (
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {liveStatus === "loading" && live.length === 0 && (topic === "all" || topic === "sports" || topic === "nfl")
              ? (
                  <>
                    <LiveGameCardSkeleton />
                    <LiveGameCardSkeleton />
                  </>
                )
              : null}
            {list.map((item) =>
              item.kind === "azuro-live" ? (
                <LiveGameCard key={item.market.id} market={item.market} />
              ) : item.kind === "live" ? (
                <LiveCard key={item.perp.id} perp={item.perp} />
              ) : item.kind === "group" ? (
                <EventCard key={item.id} group={item} />
              ) : (
                <MarketCard key={item.market.id} market={item.market} />
              ),
            )}
          </div>
        )}
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-subtle">
        Ventran · live sports on Azuro · Ventran desk{" "}
        <a
          href="https://x.com/Ventranxyz"
          className="underline decoration-border-strong underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          @Ventranxyz
        </a>
      </footer>
    </AppShell>
  );
}

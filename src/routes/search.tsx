import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MarketCard } from "@/components/markets/market-card";
import { Input } from "@/components/ui/input";
import { mergeFeedMarkets } from "@/lib/catalog";
import { CATEGORY_LABEL } from "@/lib/markets";
import { useLiveStore } from "@/lib/live-store";
import { searchLiveMarkets } from "@/lib/server/live";
import type { Market } from "@/lib/types";

export const Route = createFileRoute("/search")({ component: SearchPage });

function SearchPage() {
  const [q, setQ] = useState("");
  const live = useLiveStore((s) => s.markets);
  const [remote, setRemote] = useState<Market[]>([]);

  const local = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = mergeFeedMarkets(live);
    if (needle.length < 1) return rows.slice(0, 8);
    return rows.filter(
      (m) =>
        m.title.toLowerCase().includes(needle) ||
        m.tags.some((t) => t.includes(needle)) ||
        CATEGORY_LABEL[m.category]?.toLowerCase().includes(needle) ||
        (m.eventTitle?.toLowerCase().includes(needle) ?? false) ||
        (m.topics ?? []).some((t) => t.includes(needle)) ||
        (m.leagueName?.toLowerCase().includes(needle) ?? false),
    );
  }, [q, live]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 3) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void searchLiveMarkets({ data: needle }).then((res) => {
        if (!cancelled) setRemote(res.markets);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const out: Market[] = [];
    for (const m of [...remote, ...local]) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [local, remote]);

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Markets, topics, events"
            className="h-12 pl-9"
            autoFocus
          />
        </div>
        <p className="mt-3 text-xs text-subtle">
          {q.trim() ? `${results.length} result${results.length === 1 ? "" : "s"}` : "Trending"}
        </p>
        <div className="mt-4 grid gap-3">
          {results.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
        {results.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted">
            Nothing matches.{" "}
            <Link to="/" className="underline underline-offset-2">
              Back to markets
            </Link>
          </p>
        )}
      </main>
    </AppShell>
  );
}

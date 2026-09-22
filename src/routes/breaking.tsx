import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { BREAKING } from "@/lib/catalog";
import { CLOCK_ORIGIN } from "@/lib/history";
import { formatTimeAgo } from "@/lib/format";

export const Route = createFileRoute("/breaking")({ component: BreakingPage });

function BreakingPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Breaking</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">What just moved</h1>
        <ul className="mt-6 space-y-3">
          {BREAKING.map((item) => (
            <li key={item.id} className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
              <p className="text-[11px] font-medium tracking-wide text-no uppercase">{item.kicker}</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                <span>{formatTimeAgo(CLOCK_ORIGIN - item.hoursAgo * 3_600_000)}</span>
                {item.marketSlug && (
                  <Link
                    to="/market/$slug"
                    params={{ slug: item.marketSlug }}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Trade it
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}

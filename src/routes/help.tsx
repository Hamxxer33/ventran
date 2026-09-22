import type { ReactNode } from "react";
import { useEffect } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/help")({ component: HelpPage });

function HelpPage() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">Help</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Desk notes</h1>

        <Section id="help" title="Help Center">
          <p>
            Ventran is a paper prediction desk. Prices are probabilities. Yes pays $1 if it resolves,
            $0 otherwise. Guests trade a local book. Sign in to join the shared AMM, tape, limits, and
            combos.
          </p>
        </Section>
        <Section id="docs" title="Documentation">
          <p>
            Long-dated markets use an LMSR AMM. Limit orders rest until the AMM crosses. Combos are 2–3
            independent legs; the combined price is the product of implieds. Five-minute perps are a
            separate rolling game with a simulated path — they are not a live exchange feed.
          </p>
        </Section>
        <Section id="apis" title="APIs">
          <p>
            There is no public REST API. The shared book is served by signed-in server functions on this
            app. If you are building against Ventran later, this page is where keys would live.
          </p>
        </Section>
        <Section id="accuracy" title="Accuracy">
          <p>
            Rank and XP track activity, not calibration. Settled 5m perps on your desk are the only
            resolved tape today. Long-dated events stay open until their stated deadline.
          </p>
        </Section>
        <Section id="status" title="Status">
          <p>Paper book: live. Shared desk: live for signed-in traders. Grok briefs: on request, cached.</p>
        </Section>
        <Section id="privacy" title="Privacy">
          <p>
            Sign-in is Google or X through the app’s auth. We store your desk profile, paper book, and
            follows on this app — no wallet, no on-chain identity. Paper USDC never leaves the desk.
          </p>
        </Section>
        <Section id="terms" title="Terms of Use">
          <p>
            Everything here is paper USDC. Nothing is on-chain, nothing is an offer of a real contract,
            and nothing is financial advice. Built for{" "}
            <a
              href="https://x.com/Ventranxyz"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              @Ventranxyz
            </a>
            .
          </p>
        </Section>
      </main>
    </AppShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-24">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

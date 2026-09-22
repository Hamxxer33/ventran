import { useState } from "react";
import { FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useClientSession } from "@/lib/use-client-session";
import { grokBrief } from "@/lib/server/desk";

export function GrokBrief({ marketId }: { marketId: string }) {
  const { user, isPending } = useClientSession();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await grokBrief({ data: marketId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setText(res.text);
    } catch {
      setError("Could not reach Grok.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Grok brief</p>
          <h2 className="text-sm font-semibold tracking-tight">What would move this book</h2>
        </div>
        {user ? (
          <Button size="sm" variant="outline" onClick={() => void run()} disabled={busy}>
            <FileText className="size-3.5" />
            {busy ? "Reading…" : text ? "Refresh" : "Ask Grok"}
          </Button>
        ) : isPending ? (
          <div className="h-9 w-24 animate-pulse rounded-sm bg-card-2" />
        ) : (
          <Link to="/login" className="text-sm font-medium underline underline-offset-2">
            Sign in
          </Link>
        )}
      </div>
      {text && <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>}
      {error && <p className="mt-3 text-sm text-no">{error}</p>}
      {!text && !error && (
        <p className="mt-3 text-sm text-subtle">
          One tight note on positioning — cached per market, never auto-fired.
        </p>
      )}
    </section>
  );
}

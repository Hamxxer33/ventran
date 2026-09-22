import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientSession } from "@/lib/use-client-session";
import { setAlert } from "@/lib/server/desk";

export function PriceAlert({ marketId, lastCents }: { marketId: string; lastCents: number }) {
  const { user, isPending } = useClientSession();
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState(String(lastCents));
  const [busy, setBusy] = useState(false);

  if (isPending) return null;
  if (!user) {
    return (
      <p className="text-sm text-muted">
        <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
          Sign in
        </Link>{" "}
        to rest a price alert on this book.
      </p>
    );
  }

  async function save() {
    const n = Number(threshold) / 100;
    if (busy || n <= 0 || n >= 1) return;
    setBusy(true);
    try {
      await setAlert({ data: { marketId, direction, threshold: n } });
      toast.success(`Alert if last goes ${direction} ${threshold}¢`);
    } catch {
      toast.error("Could not set alert");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Alert</span>
        <div className="mt-1.5 flex gap-2">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "above" | "below")}
            className="h-11 rounded-sm bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none"
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <Input
            className="font-mono tabular-nums"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>
      </label>
      <Button size="sm" variant="outline" onClick={() => void save()} disabled={busy}>
        {busy ? "Saving…" : "Watch cents"}
      </Button>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TraderAvatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { useClientSession } from "@/lib/use-client-session";
import { formatTimeAgo } from "@/lib/format";
import { hueFromId } from "@/lib/ranks";
import { addComment, listComments } from "@/lib/server/desk";
import type { Market } from "@/lib/types";

type Row = { id: number | string; handle: string; displayName?: string; body: string; at: number; avatarHue: number };

export function MarketComments({ market }: { market: Market }) {
  const { user, isPending } = useClientSession();
  const [rows, setRows] = useState<Row[]>(() =>
    market.comments.map((c) => ({
      id: c.id,
      handle: c.user,
      body: c.text,
      at: c.at,
      avatarHue: hueFromId(c.user),
    })),
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void listComments({ data: market.id })
      .then((live) => {
        if (cancelled || live.length === 0) return;
        setRows(
          live.map((c) => ({
            id: c.id,
            handle: c.handle,
            displayName: c.displayName,
            body: c.body,
            at: new Date(c.at).getTime(),
            avatarHue: c.avatarHue,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [market.id, user, isPending]);

  async function post() {
    const text = body.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    try {
      const res = await addComment({ data: { marketId: market.id, body: text } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => [
        {
          id: `local-${Date.now()}`,
          handle: res.handle,
          displayName: res.displayName,
          body: res.body,
          at: Date.now(),
          avatarHue: hueFromId(res.handle),
        },
        ...prev,
      ]);
      setBody("");
    } catch {
      toast.error("Could not post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold tracking-tight">Thread</h2>
      {user && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 280))}
            placeholder="Take the other side in public"
            rows={2}
            className="min-h-11 flex-1 resize-none rounded-sm bg-card px-3 py-2 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <Button type="submit" disabled={busy || body.trim().length < 2} className="sm:self-end">
            {busy ? "Posting…" : "Post"}
          </Button>
        </form>
      )}
      {!isPending && !user && (
        <p className="mt-3 text-sm text-muted">
          <Link to="/login" className="font-medium text-foreground underline underline-offset-2">
            Sign in
          </Link>{" "}
          to post on the shared thread.
        </p>
      )}
      <ul className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <li key={String(row.id)} className="flex gap-3 py-3">
            <TraderAvatar handle={row.handle} hue={row.avatarHue} size="sm" />
            <div className="min-w-0">
              <p className="text-sm">
                <Link
                  to="/u/$handle"
                  params={{ handle: row.handle }}
                  className="font-medium hover:underline"
                >
                  @{row.handle}
                </Link>{" "}
                <span className="text-muted">{row.body}</span>
              </p>
              <p className="mt-0.5 text-xs text-subtle">{formatTimeAgo(row.at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

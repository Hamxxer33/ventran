import { useEffect } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrapDesk } from "@/lib/server/desk";
import { usePerpStore } from "@/lib/perp-store";
import { useMarketStore } from "@/lib/store";
import { useLiveStore } from "@/lib/live-store";
import { startOddsSocket, stopOddsSocket } from "@/lib/protocol/ws";

export function StoreRuntime() {
  const { user, isPending } = useCurrentUserState();
  const applySnapshot = useMarketStore((s) => s.applySnapshot);
  const hydrate = useMarketStore((s) => s.hydrate);
  const tick = useMarketStore((s) => s.tick);
  const unlink = useMarketStore((s) => s.unlink);
  const liveMarkets = useLiveStore((s) => s.markets);
  const refreshLive = useLiveStore((s) => s.refresh);
  const patchOdds = useLiveStore((s) => s.patchOdds);

  useEffect(() => {
    hydrate();
    const id = window.setInterval(tick, 3800);
    return () => window.clearInterval(id);
  }, [hydrate, tick]);

  useEffect(() => {
    const id = window.setInterval(() => {
      usePerpStore.getState().settle(Date.now());
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void refreshLive();
    const id = window.setInterval(() => {
      void refreshLive();
    }, 25_000);
    return () => window.clearInterval(id);
  }, [refreshLive]);

  useEffect(() => {
    const ids = liveMarkets.map((m) => m.conditionId).filter((x): x is string => Boolean(x));
    if (!ids.length) return;
    startOddsSocket(ids, (conditionId, odds, state) => {
      patchOdds(conditionId, odds, state);
    });
    return () => stopOddsSocket();
  }, [liveMarkets, patchOdds]);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      if (useMarketStore.getState().linked) unlink();
      return;
    }
    let cancelled = false;
    void bootstrapDesk({ data: { displayName: user.displayName } })
      .then((snap) => {
        if (!cancelled) applySnapshot(snap);
      })
      .catch(() => {
        /* signed-out or bootstrap failed — stay on local paper */
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending, applySnapshot, unlink]);

  return null;
}

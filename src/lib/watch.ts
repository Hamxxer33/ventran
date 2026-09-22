import { toggleWatch as toggleWatchRemote } from "@/lib/server/desk";
import { useMarketStore } from "@/lib/store";

export function watchMarket(marketId: string) {
  const before = useMarketStore.getState();
  before.toggleWatch(marketId);
  if (!before.linked && !useMarketStore.getState().linked) return;
  void toggleWatchRemote({ data: marketId }).catch(() => {
    useMarketStore.getState().toggleWatch(marketId);
  });
}

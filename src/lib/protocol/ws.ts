import { azuroChain } from "./config";

type Handler = (conditionId: string, odds: Record<string, number>, state?: string) => void;

let socket: WebSocket | null = null;
let wanted = new Set<string>();
let handler: Handler | null = null;
let retry = 0;
let timer: number | null = null;

function url(): string {
  const base = azuroChain().socket.replace(/\/$/, "");
  return base.endsWith("/feed") ? base : `${base}/feed`;
}

function subscribe(ids: string[]) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !ids.length) return;
  socket.send(
    JSON.stringify({
      event: "SubscribeConditions",
      data: { conditionIds: ids, environment: azuroChain().environment },
    }),
  );
}

function open() {
  if (typeof WebSocket === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  try {
    socket = new WebSocket(url());
  } catch {
    schedule();
    return;
  }
  socket.onopen = () => {
    retry = 0;
    subscribe([...wanted]);
  };
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data)) as {
        event?: string;
        data?: {
          conditionId?: string;
          id?: string;
          state?: string;
          outcomes?: { outcomeId?: number | string; id?: number | string; currentOdds?: string; odds?: string }[];
        };
      };
      if (msg.event && msg.event !== "ConditionUpdated") return;
      const payload = msg.data;
      if (!payload) return;
      const conditionId = String(payload.conditionId ?? payload.id ?? "");
      if (!conditionId) return;
      const odds: Record<string, number> = {};
      for (const o of payload.outcomes ?? []) {
        const id = String(o.outcomeId ?? o.id ?? "");
        const v = Number(o.currentOdds ?? o.odds);
        if (id && v > 1) odds[id] = v;
      }
      handler?.(conditionId, odds, payload.state);
    } catch {
      /* ignore malformed frames */
    }
  };
  socket.onclose = () => schedule();
  socket.onerror = () => {
    try {
      socket?.close();
    } catch {
      /* */
    }
  };
}

function schedule() {
  if (timer) window.clearTimeout(timer);
  const wait = Math.min(15_000, 800 * 2 ** retry);
  retry += 1;
  timer = window.setTimeout(() => {
    socket = null;
    if (wanted.size) open();
  }, wait);
}

export function startOddsSocket(conditionIds: string[], onUpdate: Handler) {
  handler = onUpdate;
  wanted = new Set(conditionIds.filter(Boolean));
  if (!wanted.size) {
    stopOddsSocket();
    return;
  }
  if (socket?.readyState === WebSocket.OPEN) {
    subscribe([...wanted]);
    return;
  }
  open();
}

export function stopOddsSocket() {
  wanted = new Set();
  handler = null;
  if (timer) window.clearTimeout(timer);
  timer = null;
  try {
    socket?.close();
  } catch {
    /* */
  }
  socket = null;
}

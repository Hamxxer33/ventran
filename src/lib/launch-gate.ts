export const LAUNCH_AT_MS = Date.parse("2026-09-29T00:00:00.000Z");
export const ACCESS_STORAGE_KEY = "ventran-access";
export const ACCESS_KEYS = ["1982556"] as const;

export type LaunchRemain = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  live: boolean;
};

export function normalizeAccessKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function accessKeyMatches(value: string, extra?: string | null): boolean {
  const normalized = normalizeAccessKey(value);
  if (!normalized) return false;
  if ((ACCESS_KEYS as readonly string[]).includes(normalized)) return true;
  if (extra && normalized === normalizeAccessKey(extra)) return true;
  return false;
}

export function remainUntilLaunch(nowMs: number, launchAtMs = LAUNCH_AT_MS): LaunchRemain {
  const totalMs = Math.max(0, launchAtMs - nowMs);
  const live = totalMs <= 0;
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    live,
  };
}

export function isLaunchLive(nowMs: number, launchAtMs = LAUNCH_AT_MS): boolean {
  return nowMs >= launchAtMs;
}

export function padUnit(value: number, size = 2): string {
  return String(Math.max(0, value)).padStart(size, "0");
}

export function readStoredAccess(): boolean {
  try {
    return localStorage.getItem(ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistAccess(): void {
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function readQueryAccessKey(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("key");
  } catch {
    return null;
  }
}

import { CLOCK_ORIGIN } from "./history";

export function formatUsd(n: number, digits = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}b`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatUsdFull(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(p: number, digits = 0): string {
  const n = p * 100;
  if (digits === 0) return `${Math.round(n)}%`;
  return `${n.toFixed(digits)}%`;
}

export function formatCents(p: number): string {
  const cents = Math.round(p * 100);
  return `${cents}¢`;
}

export function formatShares(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSignedUsd(n: number): string {
  const body = formatUsdFull(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

export function formatVol(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B Vol.`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M Vol.`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k Vol.`;
  return `$${Math.round(n)} Vol.`;
}

export function daysUntil(iso: string, now = CLOCK_ORIGIN): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Ended";
  const hours = ms / 3_600_000;
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h left`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}d left`;
  if (days < 60) return `${Math.round(days / 7)}w left`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function percentWidth(p: number): string {
  return `${Math.round(Math.min(1, Math.max(0, p)) * 10000) / 100}%`;
}

export function formatTimeAgo(ts: number, now = CLOCK_ORIGIN): string {
  const s = Math.max(1, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

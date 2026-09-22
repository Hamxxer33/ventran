import { KeyRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { VentranMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  accessKeyMatches,
  isLaunchLive,
  padUnit,
  persistAccess,
  readQueryAccessKey,
  readStoredAccess,
  remainUntilLaunch,
} from "@/lib/launch-gate";
import { cn } from "@/lib/utils";

function extraAccessKey(): string | undefined {
  const value = import.meta.env.VITE_LAUNCH_ACCESS_KEY;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function shouldUnlock(nowMs: number): boolean {
  if (isLaunchLive(nowMs)) return true;
  if (readStoredAccess()) return true;
  return accessKeyMatches(readQueryAccessKey() ?? "", extraAccessKey());
}

function LaunchRobot() {
  return (
    <div className="launch-robot-track" aria-hidden="true">
      <div className="launch-robot-pace">
        <div className="launch-robot">
          <span className="launch-robot-antenna" />
          <div className="launch-robot-head">
            <span className="launch-robot-eye" />
            <span className="launch-robot-eye" />
          </div>
          <div className="launch-robot-torso">
            <svg viewBox="0 0 32 32" className="launch-robot-mark">
              <path d="M7.2 8.2h5.15L16 17.4 19.65 8.2h5.15L16 25.2 7.2 8.2Z" fill="currentColor" />
            </svg>
          </div>
          <span className="launch-robot-arm is-left" />
          <span className="launch-robot-arm is-right" />
          <span className="launch-robot-leg is-left" />
          <span className="launch-robot-leg is-right" />
        </div>
      </div>
      <div className="launch-robot-ground" />
    </div>
  );
}

function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remain = remainUntilLaunch(now ?? 0);
  const ready = now !== null;
  const cells = [
    { label: "Days", value: ready ? padUnit(remain.days) : "--" },
    { label: "Hours", value: ready ? padUnit(remain.hours) : "--" },
    { label: "Mins", value: ready ? padUnit(remain.minutes) : "--" },
    { label: "Secs", value: ready ? padUnit(remain.seconds) : "--" },
  ];

  return (
    <div
      className="grid grid-cols-4 gap-2"
      aria-live="polite"
      aria-label={
        ready
          ? `${remain.days} days ${remain.hours} hours ${remain.minutes} minutes ${remain.seconds} seconds until launch`
          : "Counting down to launch"
      }
    >
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-md bg-card-2 px-1 py-3 text-center">
          <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-3xl">
            {cell.value}
          </div>
          <div className="mt-1 text-xs font-medium uppercase tracking-wider text-subtle">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}

function LaunchGateOverlay({ onUnlock }: { onUnlock: () => void }) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (accessKeyMatches(value, extraAccessKey())) {
      persistAccess();
      onUnlock();
      return;
    }
    setError(true);
    setShake((n) => n + 1);
  }

  return (
    <div className="launch-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="launch-gate-title">
      <div className="launch-gate-stage">
        <LaunchRobot />
        <div className="launch-gate-panel">
        <div className="flex items-center gap-2 text-foreground">
          <VentranMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight">Ventran</span>
        </div>
        <h1 id="launch-gate-title" className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
          Trade what's next
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The desk opens 29 September 2026. Watch the clock, or enter an invite key to go in now.
        </p>
        <div className="mt-6">
          <Countdown />
        </div>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound className="size-4 text-muted" />
            Invite key
          </label>
          <div className={cn("flex flex-col gap-2 sm:flex-row", shake > 0 && "launch-key-shake")} key={shake}>
            <Input
              ref={inputRef}
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(false);
              }}
              placeholder="Enter access key"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={error}
              aria-describedby={error ? errorId : undefined}
              className="flex-1"
            />
            <Button type="submit" className="w-full sm:w-auto">
              Unlock
            </Button>
          </div>
          {error ? (
            <p id={errorId} className="text-sm text-no">
              That key does not open the desk.
            </p>
          ) : (
            <p className="text-xs text-subtle">Keys are issued by the Ventran desk.</p>
          )}
        </form>
      </div>
      </div>
    </div>
  );
}

export function LaunchGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const extra = extraAccessKey();
    const apply = () => {
      const now = Date.now();
      if (!shouldUnlock(now)) return false;
      if (!isLaunchLive(now) && accessKeyMatches(readQueryAccessKey() ?? "", extra)) {
        persistAccess();
      }
      setLocked(false);
      return true;
    };
    if (apply()) return;
    const id = window.setInterval(() => {
      if (apply()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [locked]);

  return (
    <>
      <div className={cn(locked && "launch-gate-blur")} inert={locked ? true : undefined} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked ? <LaunchGateOverlay onUnlock={() => setLocked(false)} /> : null}
    </>
  );
}

import { cn } from "@/lib/utils";

export function VentranMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M7.2 8.2h5.15L16 17.4 19.65 8.2h5.15L16 25.2 7.2 8.2Z" fill="#F4F3EE" />
    </svg>
  );
}

export function VentranWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-foreground", className)}>
      <VentranMark />
      <span className="text-[17px] font-semibold tracking-tight">Ventran</span>
    </span>
  );
}

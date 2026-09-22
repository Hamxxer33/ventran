import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "yes" | "no";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "neutral" && "bg-card-2 text-muted",
        tone === "yes" && "bg-yes-soft text-yes",
        tone === "no" && "bg-no-soft text-no",
        className,
      )}
    >
      {children}
    </span>
  );
}

import { cn } from "@/lib/utils";

export function TraderAvatar({
  handle,
  hue,
  size = "md",
}: {
  handle: string;
  hue: number;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-16 text-lg" : size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-primary-fg",
        dim,
      )}
      style={{ backgroundColor: `hsl(${hue} 32% 28%)` }}
      aria-hidden
    >
      {handle.slice(0, 2).toUpperCase()}
    </span>
  );
}

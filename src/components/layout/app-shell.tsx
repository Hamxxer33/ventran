import type { ReactNode } from "react";
import { StoreRuntime } from "./store-runtime";
import { Ticker } from "./ticker";
import { Header } from "./header";
import { ModeBar } from "./mode-bar";
import { BottomNav } from "./bottom-nav";
import { ThemeRoot } from "@/components/theme-root";

export function AppShell({
  children,
  category,
  onCategory,
  showTicker = true,
}: {
  children: ReactNode;
  category?: string;
  onCategory?: (c: string) => void;
  showTicker?: boolean;
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background pb-16 text-foreground md:pb-0">
      <ThemeRoot />
      <StoreRuntime />
      {showTicker && (
        <div className="hidden md:block">
          <Ticker />
        </div>
      )}
      <Header category={category} onCategory={onCategory} />
      <ModeBar />
      {children}
      <BottomNav />
    </div>
  );
}

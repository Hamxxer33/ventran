import { useEffect } from "react";
import { toast } from "sonner";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { azuroChainId } from "@/lib/protocol/config";
import { linkWallet } from "@/lib/server/orders";
import { useClientSession } from "@/lib/use-client-session";
import { cn } from "@/lib/utils";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function WalletChip({ className }: { className?: string }) {
  const { address, isConnected, chainId, status } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { user } = useClientSession();
  const need = azuroChainId();

  useEffect(() => {
    if (!user || !address) return;
    void linkWallet({ data: { address, chainId: chainId ?? need } }).catch(() => undefined);
  }, [user, address, chainId, need]);

  useEffect(() => {
    if (error) toast.error(error.message || "Wallet failed");
  }, [error]);

  if (status === "connecting" || status === "reconnecting") {
    return <div className={cn("h-9 w-24 animate-pulse rounded-sm bg-card-2", className)} />;
  }

  if (!isConnected || !address) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={className}
        disabled={isPending}
        onClick={() => {
          const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
          if (!injected) {
            toast.error("No browser wallet found. Open the published app with MetaMask or Rabby.");
            return;
          }
          connect({ connector: injected });
        }}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </Button>
    );
  }

  const wrong = chainId !== need;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {wrong ? (
        <Button
          size="sm"
          variant="no"
          disabled={switching}
          onClick={() => switchChain({ chainId: need === 137 ? polygon.id : need })}
        >
          {switching ? "Switching…" : "Switch network"}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => disconnect()}
          className="hidden h-9 items-center rounded-sm px-2 font-mono text-[12px] text-muted hover:bg-card-2 hover:text-foreground sm:inline-flex"
          title="Disconnect wallet"
        >
          {shortAddr(address)}
        </button>
      )}
    </div>
  );
}

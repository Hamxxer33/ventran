import {
  createCashout,
  getCashoutTypedData,
  lpAbi,
} from "@azuro-org/toolkit";
import type { Address, Hash, Hex, WalletClient } from "viem";
import { CASHOUT_ATTENTION, azuroChainId } from "./config";
import { cashoutOddsForSign } from "./exit";
import { quoteCashout, pollCashout } from "@/lib/server/live";
import { patchChainOrder, recordChainOrder } from "@/lib/server/orders";

type ChainReader = {
  waitForTransactionReceipt: (args: { hash: Hash }) => Promise<{ status: string }>;
};

export type ExitProgress =
  | { step: "quote" }
  | { step: "network" }
  | { step: "sign" }
  | { step: "submit" }
  | { step: "confirm"; txHash?: string }
  | { step: "done"; txHash?: string }
  | { step: "error"; error: string };

export async function cashoutAzuroBet(opts: {
  wallet: WalletClient;
  account: Address;
  chainId: number;
  graphBetId: string;
  marketId: string;
  onProgress?: (p: ExitProgress) => void;
}): Promise<{ ok: true; orderId: string; txHash?: string; amount: number } | { ok: false; error: string }> {
  const { wallet, account, graphBetId, marketId, onProgress } = opts;
  const notify = (p: ExitProgress) => onProgress?.(p);
  try {
    notify({ step: "quote" });
    const quote = await quoteCashout({ data: { graphBetId, account } });
    if (!quote.ok) return { ok: false, error: quote.error };
    if (opts.chainId !== quote.chainId) {
      notify({ step: "network" });
      return { ok: false, error: `Switch to the trading network (chain ${quote.chainId}).` };
    }
    notify({ step: "sign" });
    const typed = getCashoutTypedData({
      chainId: azuroChainId(),
      account,
      attention: CASHOUT_ATTENTION,
      tokenId: quote.tokenId,
      cashoutOdds: cashoutOddsForSign(quote.cashoutOdds),
      expiredAt: quote.approveExpiredAt,
    });
    const signature = (await wallet.signTypedData(
      typed as Parameters<WalletClient["signTypedData"]>[0],
    )) as Hex;
    notify({ step: "submit" });
    const created = await createCashout({
      chainId: azuroChainId(),
      calculationId: quote.calculationId,
      attention: CASHOUT_ATTENTION,
      signature,
    });
    if (created.state === "REJECTED") {
      const err = created.errorMessage || "Cashout rejected";
      await recordChainOrder({
        data: {
          wallet: account,
          venue: "azuro",
          marketId,
          outcomeId: "cashout",
          action: "sell",
          amountUsd: quote.amount,
          status: "Rejected",
          orderId: created.id,
          error: err,
        },
      }).catch(() => undefined);
      return { ok: false, error: err };
    }
    await recordChainOrder({
      data: {
        wallet: account,
        venue: "azuro",
        marketId,
        outcomeId: "cashout",
        action: "sell",
        amountUsd: quote.amount,
        status: created.state,
        orderId: created.id,
      },
    }).catch(() => undefined);
    notify({ step: "confirm" });
    let txHash: string | undefined;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const polled = await pollCashout({ data: created.id });
      if (!polled.ok || !polled.cashout) continue;
      txHash = polled.cashout.txHash || txHash;
      const st = polled.cashout.state;
      if (st === "ACCEPTED") {
        await patchChainOrder({
          data: { orderId: created.id, status: "CashedOut", txHash },
        }).catch(() => undefined);
        notify({ step: "done", txHash });
        return { ok: true, orderId: created.id, txHash, amount: quote.amount };
      }
      if (st === "REJECTED") {
        const err = polled.cashout.errorMessage || "Cashout rejected";
        await patchChainOrder({
          data: { orderId: created.id, status: "Rejected", txHash, error: err },
        }).catch(() => undefined);
        return { ok: false, error: err };
      }
    }
    notify({ step: "done", txHash });
    return { ok: true, orderId: created.id, txHash, amount: quote.amount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cashout failed";
    notify({ step: "error", error: message });
    return { ok: false, error: message };
  }
}

export async function claimAzuroPayout(opts: {
  wallet: WalletClient;
  account: Address;
  chainId: number;
  tokenId: string;
  core: string;
  lpAddress: string;
  marketId: string;
  amountUsd: number;
  publicClient: ChainReader;
  onProgress?: (p: ExitProgress) => void;
}): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  const { wallet, account, tokenId, core, lpAddress, marketId, amountUsd, publicClient, onProgress } = opts;
  const notify = (p: ExitProgress) => onProgress?.(p);
  try {
    if (opts.chainId !== azuroChainId()) {
      notify({ step: "network" });
      return { ok: false, error: `Switch to the trading network (chain ${azuroChainId()}).` };
    }
    notify({ step: "submit" });
    const hash = await wallet.writeContract({
      account,
      chain: wallet.chain,
      address: lpAddress as Address,
      abi: lpAbi,
      functionName: "withdrawPayout",
      args: [core as Address, BigInt(tokenId)],
    });
    notify({ step: "confirm", txHash: hash });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") return { ok: false, error: "Claim reverted on-chain." };
    await recordChainOrder({
      data: {
        wallet: account,
        venue: "azuro",
        marketId,
        outcomeId: "claim",
        action: "sell",
        amountUsd,
        status: "Claimed",
        txHash: hash,
      },
    }).catch(() => undefined);
    notify({ step: "done", txHash: hash });
    return { ok: true, txHash: hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claim failed";
    notify({ step: "error", error: message });
    return { ok: false, error: message };
  }
}

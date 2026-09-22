import {
  createBet,
  getBetTypedData,
  type BetClientData,
} from "@azuro-org/toolkit";
import { parseUnits, type Address, type Hash, type Hex, type WalletClient } from "viem";
import { ATTENTION, azuroAffiliate, azuroChainId } from "./config";
import { quoteIsFresh } from "./quote";
import type { LiveQuote } from "@/lib/server/live";
import { pollLiveOrder } from "@/lib/server/live";
import { patchChainOrder, recordChainOrder } from "@/lib/server/orders";
import { ERC20_ABI } from "@/lib/wallet/config";

export type PlaceProgress =
  | { step: "quote" }
  | { step: "network" }
  | { step: "approve"; hash?: string }
  | { step: "fee"; hash?: string }
  | { step: "sign" }
  | { step: "submit"; orderId?: string }
  | { step: "confirm"; orderId: string; txHash?: string }
  | { step: "done"; orderId: string; txHash?: string }
  | { step: "error"; error: string };

type ChainReader = {
  readContract: (args: Record<string, unknown>) => Promise<unknown>;
  waitForTransactionReceipt: (args: { hash: Hash }) => Promise<{ status: string }>;
};

function toHex(v: string): Address {
  return v as Address;
}

export async function placeAzuroBet(opts: {
  wallet: WalletClient;
  account: Address;
  chainId: number;
  quote: Extract<LiveQuote, { ok: true }>;
  amount: number;
  marketId: string;
  outcomeId: string;
  publicClient: ChainReader;
  onProgress?: (p: PlaceProgress) => void;
}): Promise<{ ok: true; orderId: string; txHash?: string } | { ok: false; error: string }> {
  const { wallet, account, quote, marketId, outcomeId, publicClient, onProgress } = opts;
  const notify = (p: PlaceProgress) => onProgress?.(p);
  try {
    if (opts.chainId !== quote.chainId) {
      notify({ step: "network" });
      return { ok: false, error: `Switch to the trading network (chain ${quote.chainId}).` };
    }
    if (!quoteIsFresh(quote.quotedAt)) {
      return { ok: false, error: "Quote expired. Refresh and try again." };
    }
    const decimals = quote.decimals || 6;
    const stake = quote.stake > 0 ? quote.stake : opts.amount;
    const raw = parseUnits(stake.toFixed(decimals), decimals);
    const feeRaw = BigInt(quote.relayerFeeRaw || "0");
    const platRaw =
      quote.platformFee > 0 && quote.feeTo
        ? parseUnits(quote.platformFee.toFixed(decimals), decimals)
        : 0n;
    const need = raw + feeRaw + platRaw;
    const token = toHex(quote.token);
    const relayer = toHex(quote.relayer);
    const balance = (await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
    if (balance < need) {
      return {
        ok: false,
        error: `Not enough ${quote.tokenSymbol}. Need ${(Number(need) / 10 ** decimals).toFixed(2)}, have ${(Number(balance) / 10 ** decimals).toFixed(2)}.`,
      };
    }
    const spendForRelayer = raw + feeRaw;
    const allowance = (await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, relayer],
    })) as bigint;
    if (allowance < spendForRelayer) {
      notify({ step: "approve" });
      const hash = await wallet.writeContract({
        account,
        chain: wallet.chain,
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [relayer, spendForRelayer],
      });
      notify({ step: "approve", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") return { ok: false, error: "Token approval reverted." };
    }
    if (platRaw > 0n && quote.feeTo) {
      notify({ step: "fee" });
      const hash = await wallet.writeContract({
        account,
        chain: wallet.chain,
        address: token,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [toHex(quote.feeTo), platRaw],
      });
      notify({ step: "fee", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") return { ok: false, error: "Platform fee transfer reverted." };
    }
    notify({ step: "sign" });
    const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60;
    const affiliate = azuroAffiliate() ?? account;
    const clientData: BetClientData = {
      attention: ATTENTION,
      affiliate,
      core: toHex(quote.core),
      expiresAt,
      chainId: azuroChainId(),
      relayerFeeAmount: quote.relayerFeeRaw || "0",
      isFeeSponsored: false,
      isBetSponsored: false,
      isSponsoredBetReturnable: false,
    };
    const nonce = `${Date.now()}`;
    const typed = getBetTypedData({
      account,
      clientData,
      bet: {
        conditionId: quote.conditionId,
        outcomeId: quote.outcomeId,
        minOdds: quote.minOdds,
        amount: raw.toString(),
        nonce,
      },
    });
    const signature = (await wallet.signTypedData(
      typed as Parameters<WalletClient["signTypedData"]>[0],
    )) as Hex;
    notify({ step: "submit" });
    const created = await createBet({
      account,
      clientData,
      bet: {
        conditionId: quote.conditionId,
        outcomeId: quote.outcomeId,
        minOdds: quote.minOdds,
        amount: raw.toString(),
        nonce,
      },
      signature,
    });
    if (created.state === "Rejected") {
      const err = created.errorMessage || created.error || "Order rejected";
      await recordChainOrder({
        data: {
          wallet: account,
          venue: "azuro",
          marketId,
          outcomeId,
          amountUsd: stake,
          odds: String(quote.odds),
          feeUsd: quote.relayerFee + quote.platformFee,
          status: "Rejected",
          orderId: created.id || undefined,
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
        outcomeId,
        amountUsd: stake,
        odds: String(quote.odds),
        feeUsd: quote.relayerFee + quote.platformFee,
        status: created.state,
        orderId: created.id,
      },
    }).catch(() => undefined);
    notify({ step: "confirm", orderId: created.id });
    let txHash: string | undefined;
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const polled = await pollLiveOrder({ data: created.id });
      if (!polled.ok) continue;
      const st = polled.bet.state;
      txHash = polled.bet.txHash ?? txHash;
      if (st === "Accepted" || st === "Settled") {
        await patchChainOrder({
          data: { orderId: created.id, status: st, txHash },
        }).catch(() => undefined);
        notify({ step: "done", orderId: created.id, txHash });
        return { ok: true, orderId: created.id, txHash };
      }
      if (st === "Rejected" || st === "Canceled") {
        const err = polled.bet.errorMessage || polled.bet.error || st;
        await patchChainOrder({
          data: { orderId: created.id, status: st, txHash, error: err ?? undefined },
        }).catch(() => undefined);
        return { ok: false, error: err || "Order failed on-chain." };
      }
    }
    notify({ step: "done", orderId: created.id, txHash });
    return { ok: true, orderId: created.id, txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trade failed";
    notify({ step: "error", error: message });
    return { ok: false, error: message };
  }
}

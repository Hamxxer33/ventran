import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

function isAddr(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export const recordChainOrder = createServerFn({ method: "POST" })
  .validator(
    (d: {
      wallet: string;
      venue: string;
      marketId: string;
      outcomeId: string;
      action?: string;
      amountUsd: number;
      odds?: string;
      feeUsd?: number;
      status: string;
      orderId?: string;
      txHash?: string;
      error?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    if (!isAddr(data.wallet)) return { ok: false as const, error: "Bad wallet." };
    const sql = await getSql();
    const linked = await sql<{ user_id: string }>`
      select user_id from chain_wallets where address = ${data.wallet.toLowerCase()} limit 1
    `;
    const userId = linked[0]?.user_id ?? null;
    const rows = await sql<{ id: number }>`
      insert into chain_orders (
        user_id, wallet, venue, market_id, outcome_id, action, amount_usd, odds, fee_usd, status, order_id, tx_hash, error
      ) values (
        ${userId}, ${data.wallet.toLowerCase()}, ${data.venue}, ${data.marketId}, ${data.outcomeId},
        ${data.action ?? "buy"}, ${data.amountUsd}, ${data.odds ?? null}, ${data.feeUsd ?? 0},
        ${data.status}, ${data.orderId ?? null}, ${data.txHash ?? null}, ${data.error ?? null}
      ) returning id
    `;
    return { ok: true as const, id: rows[0]?.id };
  });

export const patchChainOrder = createServerFn({ method: "POST" })
  .validator((d: { orderId: string; status: string; txHash?: string; error?: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update chain_orders
      set status = ${data.status},
          tx_hash = coalesce(${data.txHash ?? null}, tx_hash),
          error = ${data.error ?? null}
      where order_id = ${data.orderId}
    `;
    return { ok: true as const };
  });

export const linkWallet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { address: string; chainId: number }) => d)
  .handler(async ({ context, data }) => {
    if (!isAddr(data.address)) return { ok: false as const, error: "Bad wallet." };
    const sql = await getSql();
    await sql.query(
      `insert into chain_wallets (user_id, address, chain_id) values ($1,$2,$3)
       on conflict (user_id, address, chain_id) do nothing`,
      [context.userId, data.address.toLowerCase(), data.chainId],
    );
    return { ok: true as const };
  });

export const listMyChainOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      wallet: string;
      venue: string;
      market_id: string;
      outcome_id: string;
      action: string;
      amount_usd: unknown;
      odds: string | null;
      fee_usd: unknown;
      status: string;
      order_id: string | null;
      tx_hash: string | null;
      error: string | null;
      created_at: string;
    }>`
      select o.* from chain_orders o
      where o.user_id = ${context.userId}
         or o.wallet in (select address from chain_wallets where user_id = ${context.userId})
      order by o.id desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      wallet: r.wallet,
      venue: r.venue,
      marketId: r.market_id,
      outcomeId: r.outcome_id,
      action: r.action,
      amountUsd: Number(r.amount_usd) || 0,
      odds: r.odds,
      feeUsd: Number(r.fee_usd) || 0,
      status: r.status,
      orderId: r.order_id,
      txHash: r.tx_hash,
      error: r.error,
      createdAt: r.created_at,
    }));
  });

import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  applyBuy,
  applySell,
  initPool,
  lmsrPrices,
  sharesForSpend,
  type Pool,
} from "@/lib/amm";
import { MARKETS, MARKET_BY_ID } from "@/lib/markets";
import { hueFromId } from "@/lib/ranks";
import { applyFeeBps } from "@/lib/protocol/odds";
import { platformFeeBps } from "@/lib/protocol/config";

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseQ(q: unknown): Record<string, number> {
  const obj = (typeof q === "string" ? JSON.parse(q) : q) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj ?? {})) out[k] = n(v);
  return out;
}

type PoolRow = { market_id: string; q: unknown; b: unknown; volume: unknown };

function rowToPool(row: PoolRow): Pool {
  return { q: parseQ(row.q), b: n(row.b), volume: n(row.volume) };
}

async function loadPool(sql: Sql, marketId: string): Promise<Pool | null> {
  const rows = await sql<PoolRow>`select market_id, q, b, volume from pools where market_id = ${marketId}`;
  return rows[0] ? rowToPool(rows[0]) : null;
}

async function savePool(sql: Sql, marketId: string, pool: Pool) {
  await sql.query(
    `insert into pools (market_id, q, b, volume) values ($1, $2::jsonb, $3, $4)
     on conflict (market_id) do update set q = excluded.q, b = excluded.b, volume = excluded.volume`,
    [marketId, JSON.stringify(pool.q), pool.b, pool.volume],
  );
}

async function ensurePools(sql: Sql) {
  const existing = await sql<{ market_id: string }>`select market_id from pools`;
  const have = new Set(existing.map((r) => r.market_id));
  for (const m of MARKETS) {
    if (have.has(m.id)) continue;
    const pool = initPool(m.seed, Math.max(80, m.liquidity / 25), m.seedVolume);
    await savePool(sql, m.id, pool);
  }
}

function handleFrom(name: string, userId: string) {
  const base = (name || "trader").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "trader";
  return `${base}${userId.replace(/[^a-z0-9]/gi, "").slice(-4) || "desk"}`;
}

export type Profile = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarHue: number;
  cash: number;
  deposited: number;
  xp: number;
  createdAt: string;
};

function mapProfile(r: Record<string, unknown>): Profile {
  return {
    userId: String(r.user_id),
    handle: String(r.handle),
    displayName: String(r.display_name),
    bio: String(r.bio ?? ""),
    avatarHue: n(r.avatar_hue),
    cash: n(r.cash),
    deposited: n(r.deposited),
    xp: n(r.xp),
    createdAt: String(r.created_at),
  };
}

async function ensureProfile(sql: Sql, userId: string, name: string | null): Promise<Profile> {
  const existing = await sql`select * from profiles where user_id = ${userId}`;
  if (existing[0]) return mapProfile(existing[0]);
  let handle = handleFrom(name ?? "trader", userId);
  for (let i = 0; i < 6; i++) {
    const clash = await sql`select 1 from profiles where handle = ${handle}`;
    if (clash.length === 0) break;
    handle = `${handleFrom(name ?? "trader", userId)}${i + 1}`;
  }
  const hue = hueFromId(userId);
  await sql.query(
    `insert into profiles (user_id, handle, display_name, bio, avatar_hue, cash, deposited, xp)
     values ($1,$2,$3,'', $4, 10000, 10000, 0)
     on conflict (user_id) do nothing`,
    [userId, handle, name?.trim() || handle, hue],
  );
  const rows = await sql`select * from profiles where user_id = ${userId}`;
  return mapProfile(rows[0]);
}

export type PositionDTO = {
  marketId: string;
  outcomeId: string;
  shares: number;
  cost: number;
};

export type FillDTO = {
  id: number;
  userId: string;
  handle?: string;
  marketId: string;
  outcomeId: string;
  action: "buy" | "sell";
  shares: number;
  cost: number;
  price: number;
  at: string;
};

export type LimitDTO = {
  id: number;
  marketId: string;
  outcomeId: string;
  side: "buy" | "sell";
  limitPrice: number;
  amount: number;
  filled: boolean;
};

export type ParlayDTO = {
  id: number;
  stake: number;
  combinedPrice: number;
  status: string;
  createdAt: string;
  legs: { marketId: string; outcomeId: string; price: number }[];
};

async function getPositions(sql: Sql, userId: string): Promise<PositionDTO[]> {
  const rows = await sql<{ market_id: string; outcome_id: string; shares: unknown; cost: unknown }>`
    select market_id, outcome_id, shares, cost from positions where user_id = ${userId} and shares > 0.0001
  `;
  return rows.map((r) => ({
    marketId: r.market_id,
    outcomeId: r.outcome_id,
    shares: n(r.shares),
    cost: n(r.cost),
  }));
}

async function applyFill(
  sql: Sql,
  userId: string,
  marketId: string,
  outcomeId: string,
  action: "buy" | "sell",
  shares: number,
  cost: number,
  xp: number,
) {
  const price = shares > 0 ? cost / shares : 0;
  if (action === "buy") {
    await sql.query(
      `insert into positions (user_id, market_id, outcome_id, shares, cost)
       values ($1,$2,$3,$4,$5)
       on conflict (user_id, market_id, outcome_id)
       do update set shares = positions.shares + excluded.shares, cost = positions.cost + excluded.cost`,
      [userId, marketId, outcomeId, shares, cost],
    );
    await sql`update profiles set cash = cash - ${cost}, xp = xp + ${xp} where user_id = ${userId}`;
  } else {
    const pos = await sql<{ shares: unknown; cost: unknown }>`
      select shares, cost from positions where user_id = ${userId} and market_id = ${marketId} and outcome_id = ${outcomeId}
    `;
    const held = n(pos[0]?.shares);
    const heldCost = n(pos[0]?.cost);
    const cut = held > 0 ? heldCost * (shares / held) : 0;
    await sql`update positions set shares = shares - ${shares}, cost = cost - ${cut}
      where user_id = ${userId} and market_id = ${marketId} and outcome_id = ${outcomeId}`;
    await sql`update profiles set cash = cash + ${cost}, xp = xp + ${xp} where user_id = ${userId}`;
  }
  await sql.query(
    `insert into fills (user_id, market_id, outcome_id, action, shares, cost, price)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, marketId, outcomeId, action, shares, cost, price],
  );
}

async function matchLimits(sql: Sql, marketId: string, pool: Pool) {
  const prices = lmsrPrices(pool.q, pool.b);
  const open = await sql<{
    id: number;
    user_id: string;
    outcome_id: string;
    side: string;
    limit_price: unknown;
    amount: unknown;
  }>`select id, user_id, outcome_id, side, limit_price, amount from limit_orders
     where market_id = ${marketId} and filled = false order by id asc`;
  let current = pool;
  for (const order of open) {
    const px = prices[order.outcome_id] ?? 0;
    const limit = n(order.limit_price);
    const amount = n(order.amount);
    if (order.side === "buy" && px <= limit + 1e-9) {
      const prof = await sql<{ cash: unknown }>`select cash from profiles where user_id = ${order.user_id}`;
      const cash = n(prof[0]?.cash);
      const spend = Math.min(amount, cash);
      if (spend < 1) continue;
      const shares = sharesForSpend(current, order.outcome_id, spend);
      const { pool: next, cost } = applyBuy(current, order.outcome_id, shares);
      await applyFill(sql, order.user_id, marketId, order.outcome_id, "buy", shares, cost, 15);
      await sql`update limit_orders set filled = true where id = ${order.id}`;
      current = next;
    } else if (order.side === "sell" && px >= limit - 1e-9) {
      const pos = await sql<{ shares: unknown }>`
        select shares from positions where user_id = ${order.user_id} and market_id = ${marketId} and outcome_id = ${order.outcome_id}
      `;
      const shares = Math.min(amount, n(pos[0]?.shares));
      if (shares <= 0) continue;
      const { pool: next, proceeds } = applySell(current, order.outcome_id, shares);
      await applyFill(sql, order.user_id, marketId, order.outcome_id, "sell", shares, proceeds, 15);
      await sql`update limit_orders set filled = true where id = ${order.id}`;
      current = next;
    }
  }
  return current;
}

async function allPools(sql: Sql): Promise<Record<string, Pool>> {
  await ensurePools(sql);
  const rows = await sql<PoolRow>`select market_id, q, b, volume from pools`;
  const out: Record<string, Pool> = {};
  for (const r of rows) out[r.market_id] = rowToPool(r);
  return out;
}

export const bootstrapDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { displayName?: string | null } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await ensureProfile(sql, context.userId, data.displayName ?? "Trader");
    const pools = await allPools(sql);
    const positions = await getPositions(sql, context.userId);
    const watch = await sql<{ market_id: string }>`select market_id from watchlist where user_id = ${context.userId}`;
    const fills = await sql<{
      id: number;
      market_id: string;
      outcome_id: string;
      action: string;
      shares: unknown;
      cost: unknown;
      price: unknown;
      created_at: string;
    }>`select id, market_id, outcome_id, action, shares, cost, price, created_at from fills
       where user_id = ${context.userId} order by id desc limit 50`;
    const orders = await sql<{
      id: number;
      market_id: string;
      outcome_id: string;
      side: string;
      limit_price: unknown;
      amount: unknown;
      filled: boolean;
    }>`select id, market_id, outcome_id, side, limit_price, amount, filled from limit_orders
       where user_id = ${context.userId} order by id desc limit 40`;
    const parlays = await sql<{
      id: number;
      stake: unknown;
      combined_price: unknown;
      status: string;
      created_at: string;
    }>`select id, stake, combined_price, status, created_at from parlays where user_id = ${context.userId} order by id desc limit 20`;
    const legs: { parlay_id: number; market_id: string; outcome_id: string; price: unknown }[] = [];
    for (const p of parlays) {
      const rows = await sql<{ parlay_id: number; market_id: string; outcome_id: string; price: unknown }>`
        select parlay_id, market_id, outcome_id, price from parlay_legs where parlay_id = ${p.id}
      `;
      legs.push(...rows);
    }
    const following = await sql<{ followee_id: string }>`select followee_id from follows where follower_id = ${context.userId}`;
    return {
      profile,
      pools,
      positions,
      watchlist: watch.map((w) => w.market_id),
      fills: fills.map((f) => ({
        id: f.id,
        userId: context.userId,
        marketId: f.market_id,
        outcomeId: f.outcome_id,
        action: f.action as "buy" | "sell",
        shares: n(f.shares),
        cost: n(f.cost),
        price: n(f.price),
        at: f.created_at,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        marketId: o.market_id,
        outcomeId: o.outcome_id,
        side: o.side as "buy" | "sell",
        limitPrice: n(o.limit_price),
        amount: n(o.amount),
        filled: Boolean(o.filled),
      })),
      parlays: parlays.map((p) => ({
        id: p.id,
        stake: n(p.stake),
        combinedPrice: n(p.combined_price),
        status: p.status,
        createdAt: p.created_at,
        legs: legs
          .filter((l) => l.parlay_id === p.id)
          .map((l) => ({ marketId: l.market_id, outcomeId: l.outcome_id, price: n(l.price) })),
      })),
      following: following.map((f) => f.followee_id),
    };
  });

export const executeTrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { marketId: string; outcomeId: string; action: "buy" | "sell"; amount: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    await ensurePools(sql);
    const market = MARKET_BY_ID[data.marketId];
    if (!market || market.venue === "azuro" || !market.outcomes.some((o) => o.id === data.outcomeId)) {
      return { ok: false as const, error: "Unknown market." };
    }
    let pool = await loadPool(sql, data.marketId);
    if (!pool) return { ok: false as const, error: "Book not found." };
    const amount = n(data.amount);
    if (data.action === "buy") {
      if (amount < 1) return { ok: false as const, error: "Minimum trade is $1." };
      const { net, fee } = applyFeeBps(amount, platformFeeBps());
      if (net < 1) return { ok: false as const, error: "Amount too small after fee." };
      const me = await sql<{ cash: unknown }>`select cash from profiles where user_id = ${context.userId}`;
      if (amount > n(me[0]?.cash) + 1e-9) return { ok: false as const, error: "Not enough cash." };
      const shares = sharesForSpend(pool, data.outcomeId, net);
      const { pool: next, cost } = applyBuy(pool, data.outcomeId, shares);
      await applyFill(sql, context.userId, data.marketId, data.outcomeId, "buy", shares, cost + fee, 10);
      pool = await matchLimits(sql, data.marketId, next);
    } else {
      const pos = await sql<{ shares: unknown }>`
        select shares from positions where user_id = ${context.userId} and market_id = ${data.marketId} and outcome_id = ${data.outcomeId}
      `;
      const shares = Math.min(amount, n(pos[0]?.shares));
      if (shares <= 0) return { ok: false as const, error: "No position." };
      const { pool: next, proceeds } = applySell(pool, data.outcomeId, shares);
      await applyFill(sql, context.userId, data.marketId, data.outcomeId, "sell", shares, proceeds, 5);
      pool = await matchLimits(sql, data.marketId, next);
    }
    await savePool(sql, data.marketId, pool);
    const profile = mapProfile((await sql`select * from profiles where user_id = ${context.userId}`)[0]);
    const positions = await getPositions(sql, context.userId);
    return { ok: true as const, pool, profile, positions };
  });

export const depositCash = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((usd: number) => usd)
  .handler(async ({ context, data: usd }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    const add = Math.min(5000, Math.max(0, n(usd)));
    await sql`update profiles set cash = cash + ${add}, deposited = deposited + ${add} where user_id = ${context.userId}`;
    const rows = await sql`select * from profiles where user_id = ${context.userId}`;
    return mapProfile(rows[0]);
  });

export const toggleWatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((marketId: string) => marketId)
  .handler(async ({ context, data: marketId }) => {
    const sql = await getSql();
    const hit = await sql`select 1 from watchlist where user_id = ${context.userId} and market_id = ${marketId}`;
    if (hit.length) {
      await sql`delete from watchlist where user_id = ${context.userId} and market_id = ${marketId}`;
      return { watching: false };
    }
    await sql`insert into watchlist (user_id, market_id) values (${context.userId}, ${marketId})`;
    return { watching: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { handle: string; displayName: string; bio: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, data.displayName);
    const handle = data.handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    if (handle.length < 3) return { ok: false as const, error: "Handle needs 3+ characters." };
    const taken = await sql`select user_id from profiles where handle = ${handle} and user_id <> ${context.userId}`;
    if (taken.length) return { ok: false as const, error: "Handle taken." };
    await sql`update profiles set handle = ${handle}, bio = ${data.bio.slice(0, 240)}, display_name = ${data.displayName.trim().slice(0, 32) || handle} where user_id = ${context.userId}`;
    return {
      ok: true as const,
      profile: mapProfile((await sql`select * from profiles where user_id = ${context.userId}`)[0]),
    };
  });

export const getProfileByHandle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((handle: string) => handle)
  .handler(async ({ context, data: handle }) => {
    const sql = await getSql();
    await ensurePools(sql);
    const rows = await sql`select * from profiles where handle = ${handle.toLowerCase()}`;
    if (!rows[0]) return { ok: false as const, error: "Not found." };
    const profile = mapProfile(rows[0]);
    const positions = await getPositions(sql, profile.userId);
    const fills = await sql<{
      id: number;
      market_id: string;
      outcome_id: string;
      action: string;
      shares: unknown;
      cost: unknown;
      price: unknown;
      created_at: string;
    }>`select id, market_id, outcome_id, action, shares, cost, price, created_at from fills
       where user_id = ${profile.userId} order by id desc limit 20`;
    const followers = await sql<{ c: unknown }>`select count(*) as c from follows where followee_id = ${profile.userId}`;
    const following = await sql<{ c: unknown }>`select count(*) as c from follows where follower_id = ${profile.userId}`;
    const iFollow = await sql`select 1 from follows where follower_id = ${context.userId} and followee_id = ${profile.userId}`;
    const parlaysN = await sql<{ c: unknown }>`select count(*) as c from parlays where user_id = ${profile.userId}`;
    const limitsN = await sql<{ c: unknown }>`select count(*) as c from limit_orders where user_id = ${profile.userId} and filled = true`;
    const vol = await sql<{ s: unknown }>`select coalesce(sum(cost),0) as s from fills where user_id = ${profile.userId}`;
    const fillCount = await sql<{ c: unknown }>`select count(*) as c from fills where user_id = ${profile.userId}`;
    const pools = await allPools(sql);
    return {
      ok: true as const,
      profile,
      positions,
      fills: fills.map((f) => ({
        id: f.id,
        userId: profile.userId,
        marketId: f.market_id,
        outcomeId: f.outcome_id,
        action: f.action as "buy" | "sell",
        shares: n(f.shares),
        cost: n(f.cost),
        price: n(f.price),
        at: f.created_at,
      })),
      followers: n(followers[0]?.c),
      following: n(following[0]?.c),
      iFollow: iFollow.length > 0,
      isSelf: profile.userId === context.userId,
      stats: {
        fills: n(fillCount[0]?.c),
        volume: n(vol[0]?.s),
        followers: n(followers[0]?.c),
        parlays: n(parlaysN[0]?.c),
        limitsFilled: n(limitsN[0]?.c),
      },
      pools,
    };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((handle: string) => handle)
  .handler(async ({ context, data: handle }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`select user_id from profiles where handle = ${handle.toLowerCase()}`;
    if (!rows[0] || rows[0].user_id === context.userId) return { following: false };
    const id = rows[0].user_id;
    const hit = await sql`select 1 from follows where follower_id = ${context.userId} and followee_id = ${id}`;
    if (hit.length) {
      await sql`delete from follows where follower_id = ${context.userId} and followee_id = ${id}`;
      return { following: false };
    }
    await sql`insert into follows (follower_id, followee_id) values (${context.userId}, ${id})`;
    return { following: true };
  });

export const copyPosition = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { handle: string; marketId: string; outcomeId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    const target = await sql<{ user_id: string }>`select user_id from profiles where handle = ${data.handle.toLowerCase()}`;
    if (!target[0]) return { ok: false as const, error: "Trader not found." };
    const pos = await sql<{ shares: unknown; cost: unknown }>`
      select shares, cost from positions where user_id = ${target[0].user_id} and market_id = ${data.marketId} and outcome_id = ${data.outcomeId}
    `;
    if (!pos[0] || n(pos[0].shares) <= 0) return { ok: false as const, error: "No position to copy." };
    const me = await sql<{ cash: unknown }>`select cash from profiles where user_id = ${context.userId}`;
    const spend = Math.min(n(pos[0].cost), n(me[0]?.cash), 500);
    if (spend < 1) return { ok: false as const, error: "Not enough cash to copy." };
    let pool = await loadPool(sql, data.marketId);
    if (!pool) return { ok: false as const, error: "Book not found." };
    const shares = sharesForSpend(pool, data.outcomeId, spend);
    const { pool: next, cost } = applyBuy(pool, data.outcomeId, shares);
    await applyFill(sql, context.userId, data.marketId, data.outcomeId, "buy", shares, cost, 20);
    pool = await matchLimits(sql, data.marketId, next);
    await savePool(sql, data.marketId, pool);
    const profile = mapProfile((await sql`select * from profiles where user_id = ${context.userId}`)[0]);
    const positions = await getPositions(sql, context.userId);
    return { ok: true as const, pool, profile, positions };
  });

export const getLeaders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    const pools = await allPools(sql);
    const people = await sql`select * from profiles order by xp desc`;
    const pos = await sql<{ user_id: string; market_id: string; outcome_id: string; shares: unknown; cost: unknown }>`
      select user_id, market_id, outcome_id, shares, cost from positions where shares > 0.0001
    `;
    const byUser = new Map<string, typeof pos>();
    for (const p of pos) {
      const list = byUser.get(p.user_id) ?? [];
      list.push(p);
      byUser.set(p.user_id, list);
    }
    const rows = people.map((raw) => {
      const profile = mapProfile(raw);
      let posValue = 0;
      for (const p of byUser.get(profile.userId) ?? []) {
        const pool = pools[p.market_id];
        const px = pool ? (lmsrPrices(pool.q, pool.b)[p.outcome_id] ?? 0) : 0;
        posValue += n(p.shares) * px;
      }
      const equity = profile.cash + posValue;
      const pnl = equity - profile.deposited;
      return {
        profile,
        equity,
        pnl,
        roi: profile.deposited > 0 ? pnl / profile.deposited : 0,
      };
    });
    rows.sort((a, b) => b.pnl - a.pnl);
    return rows.slice(0, 25);
  });

export const getTape = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    const following = await sql<{ followee_id: string }>`select followee_id from follows where follower_id = ${context.userId}`;
    const tape = await sql<{
      id: number;
      user_id: string;
      handle: string;
      display_name: string;
      market_id: string;
      outcome_id: string;
      action: string;
      shares: unknown;
      cost: unknown;
      price: unknown;
      created_at: string;
    }>`select f.id, f.user_id, p.handle, p.display_name, f.market_id, f.outcome_id, f.action, f.shares, f.cost, f.price, f.created_at
       from fills f join profiles p on p.user_id = f.user_id
       order by f.id desc limit 40`;
    return {
      following: [context.userId, ...following.map((f) => f.followee_id)] as string[],
      tape: tape.map((r) => ({
        id: r.id,
        userId: r.user_id,
        handle: r.handle,
        displayName: r.display_name,
        marketId: r.market_id,
        outcomeId: r.outcome_id,
        action: r.action as "buy" | "sell",
        shares: n(r.shares),
        cost: n(r.cost),
        price: n(r.price),
        at: r.created_at,
      })),
    };
  });

export const placeLimit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { marketId: string; outcomeId: string; side: "buy" | "sell"; limitPrice: number; amount: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    if (data.amount <= 0 || data.limitPrice <= 0 || data.limitPrice >= 1) {
      return { ok: false as const, error: "Check size and limit (0–1)." };
    }
    await sql.query(
      `insert into limit_orders (user_id, market_id, outcome_id, side, limit_price, amount)
       values ($1,$2,$3,$4,$5,$6)`,
      [context.userId, data.marketId, data.outcomeId, data.side, data.limitPrice, data.amount],
    );
    await sql`update profiles set xp = xp + 4 where user_id = ${context.userId}`;
    const pool = await loadPool(sql, data.marketId);
    if (pool) {
      const next = await matchLimits(sql, data.marketId, pool);
      await savePool(sql, data.marketId, next);
    }
    return { ok: true as const };
  });

export const placeParlay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { stake: number; legs: { marketId: string; outcomeId: string }[] }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    if (data.legs.length < 2 || data.legs.length > 3) {
      return { ok: false as const, error: "Combo needs 2 or 3 legs." };
    }
    const ids = new Set(data.legs.map((l) => l.marketId));
    if (ids.size !== data.legs.length) return { ok: false as const, error: "Legs must be different markets." };
    const stake = n(data.stake);
    if (stake < 1) return { ok: false as const, error: "Minimum stake is $1." };
    const me = await sql<{ cash: unknown }>`select cash from profiles where user_id = ${context.userId}`;
    if (stake > n(me[0]?.cash)) return { ok: false as const, error: "Not enough cash." };
    await ensurePools(sql);
    let combined = 1;
    const priced: { marketId: string; outcomeId: string; price: number }[] = [];
    for (const leg of data.legs) {
      const pool = await loadPool(sql, leg.marketId);
      if (!pool) return { ok: false as const, error: "Missing book." };
      const px = lmsrPrices(pool.q, pool.b)[leg.outcomeId] ?? 0;
      combined *= px;
      priced.push({ ...leg, price: px });
    }
    await sql`update profiles set cash = cash - ${stake}, xp = xp + 25 where user_id = ${context.userId}`;
    const inserted = await sql<{ id: number }>`
      insert into parlays (user_id, stake, combined_price, status) values (${context.userId}, ${stake}, ${combined}, 'open') returning id
    `;
    const id = inserted[0].id;
    for (const leg of priced) {
      await sql.query(`insert into parlay_legs (parlay_id, market_id, outcome_id, price) values ($1,$2,$3,$4)`, [
        id,
        leg.marketId,
        leg.outcomeId,
        leg.price,
      ]);
    }
    const profile = mapProfile((await sql`select * from profiles where user_id = ${context.userId}`)[0]);
    return { ok: true as const, combined, payout: stake / combined, profile };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { marketId: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await ensureProfile(sql, context.userId, "Trader");
    const body = data.body.trim().slice(0, 280);
    if (body.length < 2) return { ok: false as const, error: "Say a bit more." };
    await sql`insert into comments (user_id, market_id, body) values (${context.userId}, ${data.marketId}, ${body})`;
    await sql`update profiles set xp = xp + 8 where user_id = ${context.userId}`;
    return { ok: true as const, handle: profile.handle, displayName: profile.displayName, body };
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((marketId: string) => marketId)
  .handler(async ({ data: marketId }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      handle: string;
      display_name: string;
      body: string;
      created_at: string;
      avatar_hue: unknown;
    }>`select c.id, p.handle, p.display_name, c.body, c.created_at, p.avatar_hue
       from comments c join profiles p on p.user_id = c.user_id
       where c.market_id = ${marketId} order by c.id desc limit 30`;
    return rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      displayName: r.display_name,
      body: r.body,
      at: r.created_at,
      avatarHue: n(r.avatar_hue),
    }));
  });

export const setAlert = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { marketId: string; direction: string; threshold: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId, "Trader");
    await sql.query(`insert into alerts (user_id, market_id, direction, threshold) values ($1,$2,$3,$4)`, [
      context.userId,
      data.marketId,
      data.direction,
      data.threshold,
    ]);
    return { ok: true as const };
  });

export const grokBrief = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((marketId: string) => marketId)
  .handler(async ({ data: marketId }) => {
    const sql = await getSql();
    const cached = await sql<{ body: string; created_at: string }>`select body, created_at from briefs where market_id = ${marketId}`;
    if (cached[0]) return { ok: true as const, text: cached[0].body, cached: true };
    const market = MARKET_BY_ID[marketId];
    if (!market) return { ok: false as const, error: "Unknown market." };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available." };
    const pool = await loadPool(sql, marketId);
    const prices = pool ? lmsrPrices(pool.q, pool.b) : market.seed;
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 280,
        messages: [
          {
            role: "user",
            content: `Write a tight 90-word prediction-market brief for traders. No hype, no emoji. Market: ${market.title}. Rules: ${market.resolution}. Implied prices: ${JSON.stringify(prices)}. End with one sentence on what would move the book.`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    if (text) {
      await sql.query(
        `insert into briefs (market_id, body) values ($1,$2) on conflict (market_id) do update set body = excluded.body, created_at = now()`,
        [marketId, text],
      );
    }
    return { ok: true as const, text, cached: false };
  });

export const listBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((marketId: string) => marketId)
  .handler(async ({ data: marketId }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      handle: string;
      side: string;
      outcome_id: string;
      limit_price: unknown;
      amount: unknown;
    }>`select l.id, p.handle, l.side, l.outcome_id, l.limit_price, l.amount
       from limit_orders l join profiles p on p.user_id = l.user_id
       where l.market_id = ${marketId} and l.filled = false
       order by l.limit_price desc`;
    return rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      side: r.side as "buy" | "sell",
      outcomeId: r.outcome_id,
      limitPrice: n(r.limit_price),
      amount: n(r.amount),
    }));
  });

export const cancelLimit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from limit_orders where id = ${id} and user_id = ${context.userId} and filled = false`;
    return { ok: true as const };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (userId.startsWith("bot-")) return { ok: false as const, error: "Cannot delete this desk." };
    const sql = await getSql();
    const parlays = await sql<{ id: number }>`select id from parlays where user_id = ${userId}`;
    for (const p of parlays) {
      await sql`delete from parlay_legs where parlay_id = ${p.id}`;
    }
    await sql`delete from parlays where user_id = ${userId}`;
    await sql`delete from limit_orders where user_id = ${userId}`;
    await sql`delete from alerts where user_id = ${userId}`;
    await sql`delete from comments where user_id = ${userId}`;
    await sql`delete from watchlist where user_id = ${userId}`;
    await sql`delete from follows where follower_id = ${userId}`;
    await sql`delete from follows where followee_id = ${userId}`;
    await sql`delete from fills where user_id = ${userId}`;
    await sql`delete from positions where user_id = ${userId}`;
    await sql`delete from profiles where user_id = ${userId}`;
    await sql.query(`delete from "session" where "userId" = $1`, [userId]);
    await sql.query(`delete from "account" where "userId" = $1`, [userId]);
    await sql.query(`delete from "user" where "id" = $1`, [userId]);
    return { ok: true as const };
  });

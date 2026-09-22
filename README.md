# Ventran

Trade what’s next. Live sports on [Azuro](https://azuro.org), plus the Ventran desk for `$VENTRA`, politics, and crypto.

Built for [@Ventranxyz](https://x.com/Ventranxyz).

## What’s live

- **Sports** — Azuro V3 book (USDT on Polygon). Connect a wallet, quote, buy, cash out, claim.
- **Desk** — paper USDC markets for `$VENTRA` / politics / crypto until those list on-chain.
- **Identity** — Google / X. Wallet is only for on-chain sports, not login.

## Stack

TanStack Start, React 19, Tailwind v4, wagmi/viem, Azuro toolkit, Better Auth.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres (Neon / Supabase). Without it, paper desk is ephemeral. |
| `VITE_AZURO_CHAIN_ID` | Azuro chain. Default `137` (Polygon). |
| `VITE_AZURO_AFFILIATE` | Affiliate address for protocol margin. |
| `VITE_PLATFORM_FEE_BPS` | Extra stake fee (0–500). Off unless a fee address is also set. |
| `VITE_PLATFORM_FEE_ADDRESS` | Where the extra fee is sent. |
| `VITE_POLYGON_RPC` / `VITE_ARBITRUM_RPC` | RPC endpoints. |

Auth secrets are injected by the host when Google / X sign-in is enabled.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

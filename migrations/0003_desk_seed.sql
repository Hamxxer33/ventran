insert into fills (user_id, market_id, outcome_id, action, shares, cost, price, created_at)
values
  ('bot-arbmax', 'ventra-launch', 'yes', 'buy', 180, 122, 0.68, now() - interval '3 hours'),
  ('bot-arbmax', 'arb-tvl', 'yes', 'buy', 140, 78, 0.56, now() - interval '90 minutes'),
  ('bot-cycle', 'btc-150k', 'no', 'buy', 260, 148, 0.57, now() - interval '2 hours'),
  ('bot-cycle', 'ventra-fdv', 'no', 'buy', 90, 58, 0.64, now() - interval '40 minutes'),
  ('bot-rates', 'fed-cut-oct', 'yes', 'buy', 210, 128, 0.61, now() - interval '5 hours'),
  ('bot-rates', 'spx-eoy', 'yes', 'buy', 75, 44, 0.59, now() - interval '70 minutes'),
  ('bot-midterms', 'house-2026', 'yes', 'buy', 110, 62, 0.56, now() - interval '6 hours'),
  ('bot-midterms', 'senate-2026', 'yes', 'buy', 80, 41, 0.51, now() - interval '25 minutes')
on conflict do nothing;

insert into comments (user_id, market_id, body, created_at)
values
  ('bot-arbmax', 'ventra-launch', 'Whitelist is already live. This is trading like a done deal.', now() - interval '4 hours'),
  ('bot-cycle', 'ventra-launch', 'Contract is not deployed. Anything circulating now is noise.', now() - interval '3 hours'),
  ('bot-rates', 'fed-cut-oct', 'Dots still say one cut. Book is a bit rich on Yes.', now() - interval '2 hours'),
  ('bot-cycle', 'btc-150k', 'Selling the $150k print. Post-halving hopium is sticky.', now() - interval '80 minutes'),
  ('bot-midterms', 'house-2026', 'Maps over narratives. House Yes is the clean side.', now() - interval '50 minutes'),
  ('bot-arbmax', 'arb-tvl', 'TVL follows incentives. Arb still has the flywheel.', now() - interval '35 minutes')
on conflict do nothing;

insert into limit_orders (user_id, market_id, outcome_id, side, limit_price, amount)
values
  ('bot-cycle', 'btc-150k', 'yes', 'buy', 0.36, 220),
  ('bot-cycle', 'ventra-launch', 'no', 'buy', 0.24, 160),
  ('bot-rates', 'fed-cut-oct', 'no', 'buy', 0.34, 180),
  ('bot-arbmax', 'ventra-launch', 'yes', 'buy', 0.66, 300),
  ('bot-midterms', 'house-2026', 'yes', 'buy', 0.48, 120)
on conflict do nothing;

insert into follows (follower_id, followee_id)
values
  ('bot-arbmax', 'bot-cycle'),
  ('bot-cycle', 'bot-rates'),
  ('bot-rates', 'bot-arbmax'),
  ('bot-midterms', 'bot-rates'),
  ('bot-arbmax', 'bot-midterms')
on conflict do nothing;

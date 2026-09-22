import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteGuard, quoteIsFresh } from "./quote.ts";

const base = {
  amount: 25,
  venue: "azuro",
  status: "open",
  conditionState: "Active",
  outcomeHidden: false,
  outcomeState: "Active",
  odds: 1.8,
  minBet: 1,
  maxBet: 500,
};

function err(r: ReturnType<typeof quoteGuard>): string {
  return r.ok ? "" : r.error;
}

describe("quoteGuard", () => {
  it("accepts a live two-way", () => {
    assert.equal(quoteGuard(base).ok, true);
  });
  it("rejects closed and paused", () => {
    assert.match(err(quoteGuard({ ...base, status: "paused" })), /paused/);
    assert.match(err(quoteGuard({ ...base, status: "resolved" })), /closed/);
    assert.match(err(quoteGuard({ ...base, status: "canceled" })), /closed/);
  });
  it("rejects stale conditions and dead outcomes", () => {
    assert.match(err(quoteGuard({ ...base, conditionState: "Stopped" })), /stale/);
    assert.match(err(quoteGuard({ ...base, outcomeHidden: true })), /not available/);
    assert.match(err(quoteGuard({ ...base, odds: 1 })), /No odds/);
  });
  it("enforces min and max", () => {
    assert.match(err(quoteGuard({ ...base, amount: 0.5 })), /Minimum/);
    assert.match(err(quoteGuard({ ...base, amount: 900 })), /Max/);
  });
  it("rejects non-azuro venues", () => {
    assert.match(err(quoteGuard({ ...base, venue: "desk" })), /live book/);
  });
});

describe("quoteIsFresh", () => {
  it("expires after 25s", () => {
    const now = 1_000_000;
    assert.equal(quoteIsFresh(now - 1_000, now), true);
    assert.equal(quoteIsFresh(now - 26_000, now), false);
  });
});

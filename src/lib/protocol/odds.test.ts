import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFeeBps, impliedFromOdds, payoutFromStake, profitFromStake } from "./odds.ts";

describe("impliedFromOdds", () => {
  it("normalizes two-way odds to 1", () => {
    const p = impliedFromOdds({ a: 2, b: 2 });
    assert.equal(Object.keys(p).length, 2);
    assert.ok(Math.abs(p.a - 0.5) < 1e-9);
    assert.ok(Math.abs(p.b - 0.5) < 1e-9);
  });

  it("drops invalid odds", () => {
    const p = impliedFromOdds({ a: 1.8, b: 1, c: 0, d: 2.2 });
    assert.equal("b" in p, false);
    assert.ok(Math.abs(p.a + p.d - 1) < 1e-9);
  });
});

describe("payout", () => {
  it("multiplies stake by decimal odds", () => {
    assert.equal(payoutFromStake(10, 1.5), 15);
    assert.equal(profitFromStake(10, 1.5), 5);
  });
});

describe("applyFeeBps", () => {
  it("takes bps off the stake", () => {
    const { net, fee } = applyFeeBps(100, 50);
    assert.equal(fee, 0.5);
    assert.equal(net, 99.5);
  });
  it("is zero at 0 bps", () => {
    const { net, fee } = applyFeeBps(25, 0);
    assert.equal(fee, 0);
    assert.equal(net, 25);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectibleFee } from "./odds.ts";

describe("collectibleFee", () => {
  it("is a no-op without a destination", () => {
    const r = collectibleFee(100, 50);
    assert.equal(r.fee, 0);
    assert.equal(r.net, 100);
    assert.equal(r.collectTo, undefined);
  });

  it("is a no-op at 0 bps", () => {
    const r = collectibleFee(100, 0, "0x1111111111111111111111111111111111111111");
    assert.equal(r.fee, 0);
    assert.equal(r.net, 100);
  });

  it("splits when both bps and address exist", () => {
    const to = "0x1111111111111111111111111111111111111111";
    const r = collectibleFee(100, 50, to);
    assert.equal(r.fee, 0.5);
    assert.equal(r.net, 99.5);
    assert.equal(r.collectTo, to);
  });
});

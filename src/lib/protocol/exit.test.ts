import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCashoutBet, canClaimBet, cashoutOddsForSign, parseTokenAmount } from "./exit.ts";

describe("canCashoutBet", () => {
  it("allows accepted open bets with a graph id", () => {
    assert.equal(
      canCashoutBet({ state: "Accepted", result: null, isCashedOut: false, graphBetId: "g1" }),
      true,
    );
  });
  it("blocks settled, cashed, or pending", () => {
    assert.equal(
      canCashoutBet({ state: "Accepted", result: "Won", isCashedOut: false, graphBetId: "g1" }),
      false,
    );
    assert.equal(
      canCashoutBet({ state: "Accepted", result: null, isCashedOut: true, graphBetId: "g1" }),
      false,
    );
    assert.equal(
      canCashoutBet({ state: "Created", result: null, isCashedOut: false, graphBetId: "g1" }),
      false,
    );
    assert.equal(
      canCashoutBet({ state: "Accepted", result: null, isCashedOut: false, graphBetId: null }),
      false,
    );
  });
});

describe("canClaimBet", () => {
  it("allows won or canceled unredeemed bets", () => {
    assert.equal(
      canClaimBet({ result: "Won", isRedeemed: false, tokenId: "9", lpAddress: "0x1" }),
      true,
    );
    assert.equal(
      canClaimBet({ result: "Canceled", isRedeemed: false, tokenId: "9", lpAddress: "0x1" }),
      true,
    );
  });
  it("blocks lost, redeemed, or missing token", () => {
    assert.equal(
      canClaimBet({ result: "Lost", isRedeemed: false, tokenId: "9", lpAddress: "0x1" }),
      false,
    );
    assert.equal(
      canClaimBet({ result: "Won", isRedeemed: true, tokenId: "9", lpAddress: "0x1" }),
      false,
    );
    assert.equal(
      canClaimBet({ result: "Won", isRedeemed: false, tokenId: null, lpAddress: "0x1" }),
      false,
    );
  });
});

describe("parseTokenAmount", () => {
  it("reads decimals and raw 6dp units", () => {
    assert.equal(parseTokenAmount("12.5", 6), 12.5);
    assert.equal(parseTokenAmount("12500000", 6), 12.5);
    assert.equal(parseTokenAmount("", 6), 0);
  });
});

describe("cashoutOddsForSign", () => {
  it("keeps decimals and promotes raw ints", () => {
    assert.equal(cashoutOddsForSign("1.85"), "1.85");
    assert.equal(cashoutOddsForSign("1850000000000"), 1850000000000n);
  });
});

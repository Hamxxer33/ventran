import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConditionDetailedData, GameData } from "@azuro-org/toolkit";
import { ConditionState } from "@azuro-org/toolkit";
import { conditionToMarket, gameToMarkets, isTradeableCondition } from "./map.ts";

const game = {
  id: "g1",
  gameId: "1001",
  slug: "rams-giants",
  title: "Los Angeles Rams - New York Giants",
  startsAt: String(Math.floor(Date.now() / 1000) + 3600),
  state: "Prematch",
  turnover: "120.5",
  sport: { sportId: "44", slug: "american-football", name: "American Football", sporthub: { id: "s", slug: "sports" } },
  league: { slug: "nfl", name: "NFL", isTopLeague: true },
  country: { slug: "united-states", name: "United States" },
  participants: [
    { name: "Los Angeles Rams", image: "https://avatars.azuro.org/images/44/x/Los Angeles Rams.png" },
    { name: "New York Giants", image: null },
  ],
} as unknown as GameData;

function cond(partial: Partial<ConditionDetailedData> & { conditionId: string; title: string }): ConditionDetailedData {
  return {
    id: partial.conditionId,
    state: "Active",
    isExpressForbidden: false,
    isPrematchEnabled: true,
    isLiveEnabled: true,
    hidden: false,
    margin: "0",
    category: "winner",
    game: { gameId: "1001", sport: { sportId: "44" } },
    wonOutcomeIds: [],
    sort: "1",
    outcomes: [
      { title: "Los Angeles Rams", outcomeId: "1", odds: "1.8", sort: "1", hidden: false, state: "Active" },
      { title: "New York Giants", outcomeId: "2", odds: "2.1", sort: "2", hidden: false, state: "Active" },
    ],
    ...partial,
  } as ConditionDetailedData;
}

describe("isTradeableCondition", () => {
  it("rejects stopped and hidden", () => {
    assert.equal(isTradeableCondition(cond({ conditionId: "c1", title: "Winner", state: ConditionState.Stopped })), false);
    assert.equal(isTradeableCondition(cond({ conditionId: "c2", title: "Winner", hidden: true })), false);
  });
  it("accepts active two-way", () => {
    assert.equal(isTradeableCondition(cond({ conditionId: "c3", title: "Winner" })), true);
  });
});

describe("conditionToMarket", () => {
  it("maps odds to probabilities and keeps protocol ids", () => {
    const m = conditionToMarket(game, cond({ conditionId: "30061abc", title: "Full Time Result" }), 137);
    assert.ok(m);
    assert.equal(m!.venue, "azuro");
    assert.equal(m!.conditionId, "30061abc");
    assert.equal(m!.gameId, "1001");
    assert.equal(m!.category, "sports");
    assert.ok((m!.topics ?? []).includes("nfl"));
    assert.ok(Math.abs((m!.seed["1"] ?? 0) + (m!.seed["2"] ?? 0) - 1) < 1e-9);
    assert.equal(m!.odds?.["1"], 1.8);
    assert.match(m!.resolution, /Azuro protocol oracle/);
  });

  it("marks finished games resolved and canceled games canceled", () => {
    const finished = conditionToMarket(
      { ...game, state: "Finished" } as GameData,
      cond({ conditionId: "won1", title: "Winner", wonOutcomeIds: ["1"] }),
      137,
    );
    assert.equal(finished?.status, "resolved");
    assert.equal(finished?.resolvedOutcomeId, "1");
    const canceled = conditionToMarket(
      { ...game, state: "Canceled" } as GameData,
      cond({ conditionId: "cx", title: "Winner" }),
      137,
    );
    assert.equal(canceled?.status, "canceled");
  });
});

describe("gameToMarkets", () => {
  it("caps conditions and skips junk", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      cond({ conditionId: `c${i}`, title: `Line ${i}`, category: i === 0 ? "winner" : "total" }),
    );
    many[3] = cond({ conditionId: "stopped", title: "X", state: ConditionState.Stopped });
    const rows = gameToMarkets(game, many, 137);
    assert.ok(rows.length <= 6);
    assert.equal(rows[0]?.rowLabel, "Line 0");
    assert.ok(!rows.some((r) => r.conditionId === "stopped"));
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConditionDetailedData, GameData } from "@azuro-org/toolkit";
import { ConditionState, OutcomeState } from "@azuro-org/toolkit";
import { conditionToMarket, gameToMarkets, isTradeableCondition, pickLivePrimary } from "./map.ts";

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
    assert.equal(m!.rowLabel, "To win");
    assert.equal(m!.outcomes[0]?.short, "Rams");
    assert.equal(m!.outcomes[1]?.short, "Giants");
    assert.ok((m!.topics ?? []).includes("nfl"));
    assert.ok(Math.abs((m!.seed["1"] ?? 0) + (m!.seed["2"] ?? 0) - 1) < 1e-9);
    assert.equal(m!.odds?.["1"], 1.8);
    assert.match(m!.resolution, /Azuro protocol oracle/);
  });

  it("puts draw in the middle and strips gender suffixes", () => {
    const wnba = {
      ...game,
      title: "Atlanta Dream (W) - New York Liberty (W)",
      participants: [
        { name: "Atlanta Dream (W)", image: null },
        { name: "New York Liberty (W)", image: null },
      ],
    } as unknown as GameData;
    const m = conditionToMarket(
      wnba,
      cond({
        conditionId: "w1",
        title: "Winner",
        outcomes: [
          { title: "Draw", outcomeId: "0", odds: "12", sort: "2", hidden: false, state: OutcomeState.Active },
          { title: "New York Liberty (W)", outcomeId: "2", odds: "1.9", sort: "3", hidden: false, state: OutcomeState.Active },
          { title: "Atlanta Dream (W)", outcomeId: "1", odds: "2.1", sort: "1", hidden: false, state: OutcomeState.Active },
        ],
      }),
      137,
    );
    assert.deepEqual(
      m!.outcomes.map((o) => o.short),
      ["Atlanta Dream", "Draw", "Liberty"],
    );
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

  it("drops odd/even and player props", () => {
    const rows = gameToMarkets(game, [
      cond({
        conditionId: "oe",
        title: "New York Giants Total Points Odd/Even (incl. Overtime)",
        category: "odd_even",
      }),
      cond({
        conditionId: "half",
        title: "2nd Half - Draw No Bet",
        category: "winner",
      }),
      cond({ conditionId: "win", title: "Winner", category: "winner" }),
    ], 137);
    assert.equal(rows.some((r) => r.conditionId === "oe"), false);
    assert.equal(rows[0]?.conditionId, "win");
    assert.equal(rows[0]?.rowLabel, "To win");
    assert.equal(rows[0]?.outcomes[0]?.short, "Rams");
  });
});

describe("pickLivePrimary", () => {
  it("prefers the match winner and skips live props", () => {
    const rows = gameToMarkets(game, [
      cond({
        conditionId: "oe",
        title: "Odd/Even",
        category: "odd_even",
      }),
      cond({ conditionId: "win", title: "Full Time Result", category: "result" }),
    ], 137);
    const liveRows = rows.map((m) => ({ ...m, status: "live" as const }));
    const primary = pickLivePrimary(liveRows);
    assert.equal(primary?.conditionId, "win");
  });

  it("returns nothing when only period props exist", () => {
    const rows = gameToMarkets(
      { ...game, state: "Live" } as GameData,
      [
        cond({
          conditionId: "half",
          title: "2nd Half - Draw No Bet",
          category: "winner",
        }),
      ],
      137,
    );
    assert.equal(pickLivePrimary(rows.map((m) => ({ ...m, status: "live" as const }))), undefined);
  });
});

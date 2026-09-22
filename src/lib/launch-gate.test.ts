import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCESS_KEYS,
  accessKeyMatches,
  isLaunchLive,
  LAUNCH_AT_MS,
  normalizeAccessKey,
  padUnit,
  remainUntilLaunch,
} from "./launch-gate.ts";

describe("launch gate", () => {
  it("opens on 29 September 2026 UTC", () => {
    assert.equal(LAUNCH_AT_MS, Date.parse("2026-09-29T00:00:00.000Z"));
    assert.equal(isLaunchLive(LAUNCH_AT_MS), true);
    assert.equal(isLaunchLive(LAUNCH_AT_MS - 1), false);
  });

  it("counts remaining units until launch", () => {
    const remain = remainUntilLaunch(Date.parse("2026-09-22T03:00:00.000Z"));
    assert.equal(remain.live, false);
    assert.equal(remain.days, 6);
    assert.equal(remain.hours, 21);
    assert.equal(remain.minutes, 0);
    assert.equal(remain.seconds, 0);
  });

  it("clamps a live clock to zeros", () => {
    const remain = remainUntilLaunch(Date.parse("2026-09-30T00:00:00.000Z"));
    assert.equal(remain.live, true);
    assert.equal(remain.days, 0);
    assert.equal(remain.hours, 0);
    assert.equal(remain.minutes, 0);
    assert.equal(remain.seconds, 0);
  });

  it("accepts the shareable invite keys", () => {
    assert.deepEqual([...ACCESS_KEYS], ["VENTRAN", "$VENTRA"]);
    assert.equal(accessKeyMatches(" ventran "), true);
    assert.equal(accessKeyMatches("$ventra"), true);
    assert.equal(accessKeyMatches("nope"), false);
    assert.equal(accessKeyMatches("desk", "DESK"), true);
    assert.equal(normalizeAccessKey(" ve nt ra n "), "VENTRAN");
  });

  it("pads countdown digits", () => {
    assert.equal(padUnit(6), "06");
    assert.equal(padUnit(12, 2), "12");
  });
});

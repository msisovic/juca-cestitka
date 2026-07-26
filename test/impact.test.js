import assert from "node:assert/strict";
import test from "node:test";
import {
  CRASH_FALL_DISTANCE,
  CRASH_VERTICAL_SPEED,
  isCrashLanding,
} from "../src/impact.js";

test("only substantial vertical landings cause a crash", () => {
  assert.equal(isCrashLanding(
    CRASH_FALL_DISTANCE,
    { x: 0, y: -CRASH_VERTICAL_SPEED, z: 0 },
  ), true);
  assert.equal(isCrashLanding(2, { x: 0, y: -20, z: 0 }), false);
  assert.equal(isCrashLanding(5, { x: 60, y: -8, z: 60 }), false);
});

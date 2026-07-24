import assert from "node:assert/strict";
import test from "node:test";
import { platform, quarterTurn, ramp } from "../src/level-pieces.js";

test("level-piece helpers create composable typed definitions", () => {
  assert.equal(platform({ cells: [2, 3] }).type, "platform");
  assert.equal(ramp({ cells: [2, 4], rise: 1.1 }).type, "ramp");

  const turn = quarterTurn({ center: [3, 2], innerRadiusCells: 2 });
  assert.equal(turn.type, "quarterTurn");
  assert.equal(turn.widthCells, 2);
  assert.equal(turn.segments, 12);

  const narrowTurn = quarterTurn({
    center: [6, 2],
    innerRadiusCells: 5,
    widthCells: 1,
  });
  assert.equal(narrowTurn.widthCells, 1);
  assert.equal(Number.isInteger(narrowTurn.innerRadiusCells), true);
});

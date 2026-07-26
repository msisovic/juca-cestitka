import assert from "node:assert/strict";
import test from "node:test";
import {
  boostPad,
  hammer,
  platform,
  quarterTurn,
  rail,
  ramp,
  resolveBoundUnits,
  spiral,
} from "../src/level-pieces.js";

test("level-piece helpers create composable typed definitions", () => {
  assert.equal(platform({ cells: [2, 3] }).type, "platform");
  const northRamp = ramp({ cells: [2, 4], rise: 1.1 });
  assert.equal(northRamp.type, "ramp");
  assert.equal(northRamp.direction, "north");
  assert.equal(ramp({ direction: "east" }).direction, "east");
  const pad = boostPad({ direction: "west", speed: 36 });
  assert.equal(pad.type, "boostPad");
  assert.equal(pad.direction, "west");
  assert.equal(pad.speed, 36);
  const obstacle = hammer({ travelDirection: "north", spinDirection: -1 });
  assert.equal(obstacle.type, "hammer");
  assert.equal(obstacle.travelDirection, "north");
  assert.equal(obstacle.spinDirection, -1);
  const beam = rail({ lengthCells: 6, widthCells: 0.4 });
  assert.equal(beam.type, "rail");
  assert.equal(beam.direction, "north");
  assert.equal(beam.lengthCells, 6);

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

test("boundary edges can toggle each surface unit", () => {
  const bounds = {
    all: true,
    north: [true, true, false, true, true],
  };

  assert.deepEqual(
    resolveBoundUnits(bounds, "north", 5),
    [true, true, false, true, true],
  );
  assert.deepEqual(
    resolveBoundUnits(bounds, "south", 5),
    [true, true, true, true, true],
  );
  assert.deepEqual(
    resolveBoundUnits(false, "outer", 3),
    [false, false, false],
  );
  assert.throws(
    () => resolveBoundUnits({ west: [true] }, "west", 2),
    /must be a boolean or 2 booleans/,
  );
});

test("spirals resolve every cardinal entry and exit combination", () => {
  const directions = {
    north: { x: 0, z: -1 },
    east: { x: 1, z: 0 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
  };

  for (const clockwise of [false, true]) {
    for (const [startDirection, expectedStart] of Object.entries(directions)) {
      for (const [endDirection, expectedEnd] of Object.entries(directions)) {
        const piece = spiral({
          startDirection,
          endDirection,
          clockwise,
          turns: 1,
          innerRadiusCells: 2,
          slope: 0.5,
          boosts: { intervalAngle: Math.PI / 2, speed: 40 },
        });
        const sweepSign = Math.sign(piece.sweepAngle);
        const tangentAt = (angle) => ({
          x: -Math.sin(angle) * sweepSign,
          z: Math.cos(angle) * sweepSign,
        });
        const startTangent = tangentAt(piece.startAngle);
        const endTangent = tangentAt(piece.startAngle + piece.sweepAngle);

        assert.ok(Math.abs(startTangent.x - expectedStart.x) < 1e-10);
        assert.ok(Math.abs(startTangent.z - expectedStart.z) < 1e-10);
        assert.ok(Math.abs(endTangent.x - expectedEnd.x) < 1e-10);
        assert.ok(Math.abs(endTangent.z - expectedEnd.z) < 1e-10);
        assert.ok(piece.drop > 0);
        assert.equal(piece.boosts.speed, 40);
      }
    }
  }
});

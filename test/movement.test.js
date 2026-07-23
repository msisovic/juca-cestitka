import test from "node:test";
import assert from "node:assert/strict";
import { accelerateHorizontal } from "../src/movement.js";

test("opposing input slows and reverses velocity at a fixed rate", () => {
  let velocity = { x: 0, z: -12 };
  const speeds = [];

  for (let step = 0; step < 5; step += 1) {
    velocity = accelerateHorizontal(velocity, { x: 0, z: 1 }, 6, 0.5, 20);
    speeds.push(velocity.z);
  }

  assert.deepEqual(speeds, [-9, -6, -3, 0, 3]);
});

test("diagonal input has the same acceleration as cardinal input", () => {
  const axis = Math.SQRT1_2;
  const velocity = accelerateHorizontal(
    { x: 0, z: 0 },
    { x: axis, z: axis },
    10,
    1,
    20,
  );

  assert.ok(Math.abs(Math.hypot(velocity.x, velocity.z) - 10) < 1e-10);
});

test("acceleration respects the top speed", () => {
  const velocity = accelerateHorizontal(
    { x: 0, z: -12 },
    { x: 0, z: -1 },
    10,
    1,
    13,
  );

  assert.equal(Math.hypot(velocity.x, velocity.z), 13);
});

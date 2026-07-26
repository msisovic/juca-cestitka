import test from "node:test";
import assert from "node:assert/strict";
import {
  accelerateHorizontal,
  boostHorizontal,
  rollingAngularVelocity,
} from "../src/movement.js";

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

test("input does not clamp momentum already above the top speed", () => {
  const velocity = accelerateHorizontal(
    { x: 30, z: 0 },
    { x: 1, z: 0 },
    15,
    1,
    26,
  );

  assert.equal(Math.hypot(velocity.x, velocity.z), 30);
});

test("input can steer or brake momentum above the top speed", () => {
  const steered = accelerateHorizontal(
    { x: 30, z: 0 },
    { x: 0, z: 1 },
    15,
    0.1,
    26,
  );
  const braked = accelerateHorizontal(
    { x: 30, z: 0 },
    { x: -1, z: 0 },
    15,
    0.1,
    26,
  );

  assert.ok(steered.z > 0);
  assert.ok(Math.abs(Math.hypot(steered.x, steered.z) - 30) < 1e-10);
  assert.equal(Math.hypot(braked.x, braked.z), 28.5);
});

test("boost pads establish a minimum speed without removing lateral momentum", () => {
  assert.deepEqual(
    boostHorizontal({ x: -8, z: 3 }, { x: -1, z: 0 }, 52),
    { x: -52, z: 3 },
  );
  assert.deepEqual(
    boostHorizontal({ x: -60, z: 3 }, { x: -1, z: 0 }, 52),
    { x: -60, z: 3 },
  );
});

test("rolling spin follows the local surface normal", () => {
  assert.deepEqual(
    rollingAngularVelocity({ x: 4, y: 0, z: -6 }, { x: 0, y: 1, z: 0 }, 2),
    { x: -3, y: 0, z: -2 },
  );

  const axis = Math.SQRT1_2;
  const tilted = rollingAngularVelocity(
    { x: 0, y: 0, z: -6 },
    { x: axis, y: axis, z: 0 },
    2,
  );
  assert.ok(Math.abs(tilted.x + 3 * axis) < 1e-10);
  assert.ok(Math.abs(tilted.y - 3 * axis) < 1e-10);
  assert.equal(tilted.z, 0);
});

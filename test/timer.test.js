import assert from "node:assert/strict";
import test from "node:test";
import { formatTime, reachesFinish } from "../src/timer.js";

test("formats stopwatch time with milliseconds", () => {
  assert.equal(formatTime(0), "00:00.000");
  assert.equal(formatTime(62345.9), "01:02.345");
});

test("detects reaching the ground target", () => {
  const finish = {
    position: { x: -4, y: 1.11, z: -53 },
    radius: 2.3,
  };

  assert.equal(
    reachesFinish(
      { x: -4, y: 2.38, z: -50 },
      { x: -4, y: 2.38, z: -51 },
      finish,
    ),
    true,
  );
  assert.equal(
    reachesFinish(
      { x: 0, y: 2.38, z: -50 },
      { x: 0, y: 2.38, z: -53 },
      finish,
    ),
    false,
  );
});

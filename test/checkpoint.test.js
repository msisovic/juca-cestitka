import assert from "node:assert/strict";
import test from "node:test";
import { touchesCheckpoint } from "../src/checkpoint.js";

const checkpoint = {
  center: { x: 10, y: 2, z: -5 },
  halfWidth: 4,
  halfDepth: 3,
};

test("checkpoint activates only while the ball touches its platform", () => {
  assert.equal(touchesCheckpoint({ x: 12, y: 3, z: -6 }, checkpoint, 1), true);
  assert.equal(touchesCheckpoint({ x: 15, y: 3, z: -6 }, checkpoint, 1), false);
  assert.equal(touchesCheckpoint({ x: 12, y: 5, z: -6 }, checkpoint, 1), false);
});

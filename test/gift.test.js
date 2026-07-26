import assert from "node:assert/strict";
import test from "node:test";
import { giftStorageKey } from "../src/gift.js";

test("gift claim uses one course-wide storage key", () => {
  assert.equal(giftStorageKey(), "boston-ball:gift:v1");
});

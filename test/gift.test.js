import assert from "node:assert/strict";
import test from "node:test";
import { giftStorageKey } from "../src/gift.js";

test("gift claims are stored independently for each level", () => {
  assert.equal(giftStorageKey(1), "boston-ball:gift:v1:1");
  assert.notEqual(giftStorageKey(0), giftStorageKey(1));
});

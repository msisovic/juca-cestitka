import assert from "node:assert/strict";
import test from "node:test";
import { introStorageKey } from "../src/intro.js";

test("intro progress has its own storage key", () => {
  assert.equal(introStorageKey(), "boston-ball:intro:v1");
});

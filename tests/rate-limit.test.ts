import assert from "node:assert/strict";
import { test } from "node:test";

import { createFixedWindowLimiter } from "../lib/rate-limit";

test("blocks after the limit and recovers in the next window", () => {
  const allow = createFixedWindowLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(allow("ip", 0), true);
  assert.equal(allow("ip", 1), true);
  assert.equal(allow("ip", 2), false);
  assert.equal(allow("other", 2), true);
  assert.equal(allow("ip", 1000), true);
});

test("drops the oldest window instead of locking out new keys", () => {
  const allow = createFixedWindowLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
  allow("a", 0);
  allow("b", 0);
  assert.equal(allow("c", 0), true);
  assert.equal(allow("b", 0), false);
  assert.equal(allow("a", 0), true);
});

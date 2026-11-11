import assert from "node:assert/strict";
import { test } from "node:test";

import { exportFingerprint, hasChangesSinceExport } from "@/lib/install-methods/export-status";

const at = new Date("2026-11-11T10:00:00Z");

test("never exported: changed only when something is published", () => {
  assert.equal(hasChangesSinceExport({ exportedAt: null, exportedCount: null, publishedCount: 3, updatedSinceCount: 0 }), true);
  assert.equal(hasChangesSinceExport({ exportedAt: null, exportedCount: null, publishedCount: 0, updatedSinceCount: 0 }), false);
});

test("exported: changed on count difference (new or deleted) or later edits", () => {
  assert.equal(hasChangesSinceExport({ exportedAt: at, exportedCount: 3, publishedCount: 3, updatedSinceCount: 0 }), false);
  assert.equal(hasChangesSinceExport({ exportedAt: at, exportedCount: 3, publishedCount: 4, updatedSinceCount: 0 }), true);
  assert.equal(hasChangesSinceExport({ exportedAt: at, exportedCount: 3, publishedCount: 2, updatedSinceCount: 0 }), true);
  assert.equal(hasChangesSinceExport({ exportedAt: at, exportedCount: 3, publishedCount: 3, updatedSinceCount: 1 }), true);
});

test("a changed domain, name or theme marks the export as outdated", () => {
  const before = exportFingerprint({ domain: "Client.com", name: "Acme", widgetTheme: null });
  const base = { exportedAt: at, exportedCount: 3, publishedCount: 3, updatedSinceCount: 0, exportedFingerprint: before };

  assert.equal(hasChangesSinceExport({ ...base, currentFingerprint: before }), false);
  assert.equal(hasChangesSinceExport({ ...base, currentFingerprint: exportFingerprint({ domain: "client.com", name: "Acme", widgetTheme: null }) }), false);
  assert.equal(hasChangesSinceExport({ ...base, currentFingerprint: exportFingerprint({ domain: "other.com", name: "Acme", widgetTheme: null }) }), true);
  assert.equal(hasChangesSinceExport({ ...base, currentFingerprint: exportFingerprint({ domain: "client.com", name: "Acme", widgetTheme: "dark" }) }), true);
  // exports made before the fingerprint existed are treated as outdated
  assert.equal(hasChangesSinceExport({ ...base, exportedFingerprint: null, currentFingerprint: before }), true);
});

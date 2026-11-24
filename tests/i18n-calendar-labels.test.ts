import assert from "node:assert/strict";
import { test } from "node:test";

import { monthHeading, weekdayLabels } from "@/lib/i18n/calendar-labels";

test("weekday labels start on Sunday and follow the locale", () => {
  assert.deepEqual(weekdayLabels("en"), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const es = weekdayLabels("es");
  assert.equal(es.length, 7);
  assert.equal(es[0].toLowerCase().startsWith("dom"), true);
  assert.equal(es[1].toLowerCase().startsWith("lun"), true);
  assert.equal(es[6].toLowerCase().startsWith("s"), true);
});

test("month heading keeps English output and capitalizes Spanish", () => {
  const month = new Date(Date.UTC(2026, 10, 1));
  assert.equal(monthHeading(month, "en"), "November 2026");
  assert.equal(monthHeading(month, "es"), "Noviembre de 2026");
});

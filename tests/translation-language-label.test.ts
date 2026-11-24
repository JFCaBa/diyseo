import assert from "node:assert/strict";
import { test } from "node:test";

import { getLocalizedTranslationLanguageLabel, TRANSLATION_LANGUAGE_OPTIONS } from "@/lib/translations";

test("Spanish shows language names in Spanish", () => {
  assert.equal(getLocalizedTranslationLanguageLabel("en", "es"), "inglés");
  assert.equal(getLocalizedTranslationLanguageLabel("es", "es"), "español");
  assert.equal(getLocalizedTranslationLanguageLabel("fr", "es"), "francés");
});

test("English keeps the existing labels", () => {
  for (const option of TRANSLATION_LANGUAGE_OPTIONS) {
    assert.equal(getLocalizedTranslationLanguageLabel(option.code, "en"), option.label);
  }
});

test("an unknown code falls back to the existing label (the code itself)", () => {
  assert.equal(getLocalizedTranslationLanguageLabel("xx", "es"), "xx");
  assert.equal(getLocalizedTranslationLanguageLabel("xx", "en"), "xx");
});

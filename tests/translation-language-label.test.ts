import assert from "node:assert/strict";
import { test } from "node:test";

import { getLocalizedTranslationLanguageLabel, TRANSLATION_LANGUAGE_OPTIONS } from "@/lib/translations";

test("Spanish shows language names in Spanish, capitalized for labels", () => {
  assert.equal(getLocalizedTranslationLanguageLabel("en", "es"), "Inglés");
  assert.equal(getLocalizedTranslationLanguageLabel("es", "es"), "Español");
  assert.equal(getLocalizedTranslationLanguageLabel("fr", "es"), "Francés");
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

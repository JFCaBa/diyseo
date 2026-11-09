import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeArticleHeadings } from "../lib/article-headings";

const title = "Your Ultimate Car Buying Guide: Decode License Plates";

test("drops a leading H1 that repeats the title", () => {
  const md = "# Your Ultimate Car Buying Guide: Decode License Plates\n\nIntro text.\n\n## Section\n\nBody.";
  assert.equal(normalizeArticleHeadings(md, title), "Intro text.\n\n## Section\n\nBody.");
});

test("a leading H1 with a different text becomes an H2, like any other H1", () => {
  const md = "# Why plates matter\n\nText.\n\n# Another top section\n\nMore.";
  assert.equal(normalizeArticleHeadings(md, title), "## Why plates matter\n\nText.\n\n## Another top section\n\nMore.");
});

test("leaves H2+ headings, inline hashes and code blocks alone", () => {
  const md = "Intro #1 tip.\n\n## Keep\n\n### Keep too\n\n```bash\n# a shell comment\n```\n";
  assert.equal(normalizeArticleHeadings(md, title), md);
});

test("H1 sections push the whole outline one level down", () => {
  const md = "# Part one\n\n## Detail\n\n# Part two\n\n###### Deepest";
  assert.equal(normalizeArticleHeadings(md, title), "## Part one\n\n### Detail\n\n## Part two\n\n###### Deepest");
});

test("H1 written with extra spaces, a tab or Setext underline counts, and so does a quoted title", () => {
  assert.equal(normalizeArticleHeadings('#   "Your Ultimate Car Buying Guide: Decode License Plates."\n\nIntro.', title), "Intro.");
  assert.equal(normalizeArticleHeadings("#\tTop\n\nText", title), "##\tTop\n\nText");
  assert.equal(normalizeArticleHeadings("Top section\n===\n\nText", title), "## Top section\n\nText");
});

test("a longer fence is not closed by a shorter one inside it", () => {
  const md = "````md\n```\n# not a heading\n```\n````\n\n# Real heading";
  assert.equal(normalizeArticleHeadings(md, title), "````md\n```\n# not a heading\n```\n````\n\n## Real heading");
});

test("a leading H2 that only repeats the title is dropped too; other H2s stay", () => {
  assert.equal(normalizeArticleHeadings("## Your Ultimate Car Buying Guide: Decode License Plates\n\n### One\n\nText", title), "### One\n\nText");
  assert.equal(normalizeArticleHeadings("## Something else\n\nText", title), "## Something else\n\nText");
});

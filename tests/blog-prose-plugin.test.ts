import assert from "node:assert/strict";
import { test } from "node:test";
import typography from "@tailwindcss/typography";
import config from "../tailwind.config";
import { getPublicBlogTheme } from "../lib/public-blog-theme";

// The blog themes style article HTML through `prose*` classes, which only exist if the typography plugin is
// registered. Without it the headings, lists and spacing silently render unstyled.
test("tailwind registers the typography plugin that the blog themes depend on", () => {
  const plugins = (config.plugins ?? []) as unknown[];
  assert.ok(plugins.includes(typography), "@tailwindcss/typography must be in tailwind plugins");
  for (const mode of ["light", "dark"]) {
    assert.match(getPublicBlogTheme(mode).prose, /(^|\s)prose(\s|$)/);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSocialPostsSystemPrompt, buildSocialPostsUserPrompt } from "../lib/ai/prompts";
import { requestSocialPosts } from "../lib/ai/social";
import type { SocialPostsGenerationContext } from "../lib/ai/types";
import { mergeDrafts } from "../lib/social/drafts";
import { SOCIAL_LIMITS } from "../lib/social/limits";
import { GeneratedSocialPostsSchema } from "../lib/validations";

const tags = (n: number) => Array.from({ length: n }, (_, i) => `#tag${i}`).join(" ");
const good = { facebook: "Check any car ✅", instagram: `Check any car. Link in bio. ${tags(4)}`, x: "Check any car before you buy", linkedin: "Check any car before you buy." };

const ctx: SocialPostsGenerationContext = {
  article: { title: "How to check a used car", excerpt: "Five checks before you pay", markdown: "# Body\nText" },
  articleUrl: "https://mycarplate.online/blog/check-used-car",
  site: { name: "MyCarPlate", domain: "mycarplate.online" },
  brandProfile: { contentLanguage: "Spanish", brandVoiceTone: "Friendly", topicsToAvoid: "politics and crypto", targetAudience: "Used car buyers" }
};

test("SOCIAL_LIMITS has the agreed values", () => {
  assert.deepEqual(SOCIAL_LIMITS, { FACEBOOK: 1500, INSTAGRAM: 2000, X: 250, LINKEDIN: 1800 });
});

test("schema enforces each network limit", () => {
  assert.equal(GeneratedSocialPostsSchema.safeParse({ ...good, x: "x".repeat(251) }).success, false);
  assert.equal(GeneratedSocialPostsSchema.safeParse({ ...good, x: "x".repeat(250) }).success, true);
  assert.equal(GeneratedSocialPostsSchema.safeParse({ ...good, facebook: "f".repeat(1501) }).success, false);
});

test("instagram needs 3 to 8 hashtags", () => {
  const ig = (n: number) => GeneratedSocialPostsSchema.safeParse({ ...good, instagram: `Text ${tags(n)}` });
  assert.equal(ig(2).success, false);
  assert.equal(ig(3).success, true);
  assert.equal(ig(9).success, false);
  const r = ig(2);
  assert.ok(!r.success && r.error.issues.some((i) => i.message === "instagram needs 3 to 8 hashtags"));
});

test("system prompt states facts-only, brand voice, topics to avoid and every limit", () => {
  const p = buildSocialPostsSystemPrompt(ctx);
  for (const re of [/only facts/i, /politics and crypto/, /1500/, /2000/, /250/, /1800/, /link in (the )?bio/i, /no fake urgency/i, /Friendly/]) {
    assert.match(p, re);
  }
});

test("user prompt carries title, excerpt, article URL and the content language", () => {
  const p = buildSocialPostsUserPrompt(ctx);
  for (const s of ["How to check a used car", "Five checks before you pay", "https://mycarplate.online/blog/check-used-car", "Spanish"]) {
    assert.ok(p.includes(s), s);
  }
});

test("mergeDrafts skips PUBLISHED and PUBLISHING, keeps DRAFT and FAILED", () => {
  const out = mergeDrafts(
    [
      { network: "FACEBOOK", status: "PUBLISHED" },
      { network: "INSTAGRAM", status: "PUBLISHING" },
      { network: "X", status: "FAILED" }
    ],
    good
  );
  assert.deepEqual(out, [
    { network: "X", text: good.x },
    { network: "LINKEDIN", text: good.linkedin }
  ]);
});

test("requestSocialPosts retries once with the validation error, then succeeds", async () => {
  const calls: string[] = [];
  const result = await requestSocialPosts(async (_sys, user) => {
    calls.push(user);
    return calls.length === 1 ? { ...good, x: "x".repeat(300) } : good;
  }, ctx);
  assert.deepEqual(result, good);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /Your JSON was invalid/);
});

test("requestSocialPosts throws after the retry also fails", async () => {
  await assert.rejects(requestSocialPosts(async () => ({ ...good, x: "x".repeat(300) }), ctx));
});

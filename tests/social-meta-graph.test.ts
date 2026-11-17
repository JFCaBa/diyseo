import assert from "node:assert/strict";
import { test } from "node:test";

import { MetaGraphError, publishFacebook, publishInstagram, redact, verifyPage, type GraphDeps } from "../lib/social/meta-graph";

type Call = { method: string; url: string; body: URLSearchParams | null };
type Reply = { status?: number; json?: unknown; throws?: Error };

function fake(replies: Reply[]) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const deps: GraphDeps = {
    version: "v26.0",
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    fetch: (async (input: string | URL, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", url: String(input), body: init?.body instanceof URLSearchParams ? init.body : null });
      const r = replies.shift();
      if (!r) throw new Error("unexpected call");
      if (r.throws) throw r.throws;
      return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch
  };
  return { deps, calls, sleeps };
}

const TOKEN = "abc123TOKEN";

test("verifyPage reads name, the Page token and the linked instagram account", async () => {
  const { deps, calls } = fake([{ json: { name: "Mycarplate", access_token: "PAGE_TOKEN", instagram_business_account: { id: "17841", username: "mycarplate" } } }]);
  assert.deepEqual(await verifyPage(TOKEN, "123456", deps), { pageName: "Mycarplate", pageToken: "PAGE_TOKEN", instagramAccountId: "17841", instagramUsername: "mycarplate" });
  assert.match(calls[0].url, /^https:\/\/graph\.facebook\.com\/v26\.0\/123456\?/);
  assert.match(decodeURIComponent(calls[0].url), /fields=name,access_token,instagram_business_account\{id,username\}/);
});

test("verifyPage without instagram or access_token returns nulls and the pasted token", async () => {
  const { deps } = fake([{ json: { name: "P" } }, { json: { id: "123456" } }]);
  assert.deepEqual(await verifyPage(TOKEN, "123456", deps), { pageName: "P", pageToken: TOKEN, instagramAccountId: null, instagramUsername: null });
});

test("a Graph error becomes MetaGraphError with Meta's message, token redacted", async () => {
  const { deps } = fake([{ status: 400, json: { error: { message: `Invalid token ${TOKEN} https://graph.facebook.com/x?access_token=${TOKEN}&a=1` } } }]);
  await assert.rejects(verifyPage(TOKEN, "123456", deps), (e: unknown) => {
    assert.ok(e instanceof MetaGraphError);
    assert.ok(!e.message.includes(TOKEN));
    assert.match(e.message, /Invalid token/);
    assert.equal(e.definite, true);
    return true;
  });
});

test("redact removes the token and any access_token query value", () => {
  assert.equal(redact(`a ${TOKEN} b access_token=OTHER&x`, TOKEN), "a *** b access_token=***&x");
});

test("publishFacebook with image posts to /photos with url and a caption ending in the link", async () => {
  const { deps, calls } = fake([{ json: { id: "1", post_id: "123_9" } }]);
  const r = await publishFacebook(TOKEN, "123", { text: "Hello", imageUrl: "https://app/img.jpg", link: "https://site/blog/a" }, deps);
  assert.deepEqual(r, { id: "123_9", url: "https://www.facebook.com/123_9" });
  assert.match(calls[0].url, /\/v26\.0\/123\/photos$/);
  assert.equal(calls[0].body?.get("url"), "https://app/img.jpg");
  assert.equal(calls[0].body?.get("caption"), "Hello\n\nhttps://site/blog/a");
  assert.equal(calls[0].body?.get("access_token"), TOKEN);
});

test("publishFacebook does not append the link twice", async () => {
  const { deps, calls } = fake([{ json: { id: "1", post_id: "123_9" } }]);
  await publishFacebook(TOKEN, "123", { text: "Read https://site/blog/a", imageUrl: "https://app/img.jpg", link: "https://site/blog/a" }, deps);
  assert.equal(calls[0].body?.get("caption"), "Read https://site/blog/a");
});

test("publishFacebook without image posts to /feed with message and link", async () => {
  const { deps, calls } = fake([{ json: { id: "123_5" } }]);
  const r = await publishFacebook(TOKEN, "123", { text: "Hello", imageUrl: null, link: "https://site/blog/a" }, deps);
  assert.equal(r.id, "123_5");
  assert.match(calls[0].url, /\/123\/feed$/);
  assert.equal(calls[0].body?.get("message"), "Hello");
  assert.equal(calls[0].body?.get("link"), "https://site/blog/a");
});

test("publishInstagram polls until FINISHED, then publishes and returns the permalink", async () => {
  const { deps, calls, sleeps } = fake([
    { json: { id: "C1" } },
    { json: { status_code: "IN_PROGRESS" } },
    { json: { status_code: "IN_PROGRESS" } },
    { json: { status_code: "FINISHED" } },
    { json: { id: "M1" } },
    { json: { permalink: "https://www.instagram.com/p/abc/" } }
  ]);
  const r = await publishInstagram(TOKEN, "IG", { text: "Cap", imageUrl: "https://app/img.jpg" }, deps);
  assert.deepEqual(r, { id: "M1", url: "https://www.instagram.com/p/abc/" });
  assert.deepEqual(sleeps, [2000, 2000]);
  assert.match(calls[0].url, /\/IG\/media$/);
  assert.equal(calls[0].body?.get("image_url"), "https://app/img.jpg");
  assert.equal(calls[0].body?.get("caption"), "Cap");
  assert.match(calls[4].url, /\/IG\/media_publish$/);
  assert.equal(calls[4].body?.get("creation_id"), "C1");
});

test("publishInstagram fails on ERROR status and after 10 polls, without calling media_publish", async () => {
  const err = fake([{ json: { id: "C1" } }, { json: { status_code: "ERROR" } }]);
  await assert.rejects(publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, err.deps), (e: unknown) => e instanceof MetaGraphError && e.definite);
  assert.ok(!err.calls.some((c) => c.url.endsWith("/media_publish")));

  const slow = fake([{ json: { id: "C1" } }, ...Array.from({ length: 10 }, () => ({ json: { status_code: "IN_PROGRESS" } }))]);
  await assert.rejects(publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, slow.deps), (e: unknown) => e instanceof MetaGraphError && e.definite && /still processing/.test(e.message));
  assert.ok(!slow.calls.some((c) => c.url.endsWith("/media_publish")));
});

test("a 500 or network error on /photos or media_publish is not definite; a 400 is", async () => {
  const five = fake([{ status: 500, json: { error: { message: "Service unavailable" } } }]);
  await assert.rejects(publishFacebook(TOKEN, "1", { text: "t", imageUrl: "u", link: "l" }, five.deps), (e: unknown) => e instanceof MetaGraphError && !e.definite);

  const net = fake([{ json: { id: "C1" } }, { json: { status_code: "FINISHED" } }, { throws: new TypeError("fetch failed") }]);
  await assert.rejects(publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, net.deps), (e: unknown) => e instanceof MetaGraphError && !e.definite);

  const four = fake([{ status: 400, json: { error: { message: "(#200) Permissions error" } } }]);
  await assert.rejects(publishFacebook(TOKEN, "1", { text: "t", imageUrl: null, link: "l" }, four.deps), (e: unknown) => e instanceof MetaGraphError && e.definite);
});

test("a network error before the publishing call is definite", async () => {
  const net = fake([{ throws: new TypeError("fetch failed") }]);
  await assert.rejects(publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, net.deps), (e: unknown) => e instanceof MetaGraphError && e.definite);
});

test("a failed permalink read still returns the media id with url null", async () => {
  const { deps } = fake([{ json: { id: "C1" } }, { json: { status_code: "FINISHED" } }, { json: { id: "M1" } }, { status: 500, json: {} }]);
  assert.deepEqual(await publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, deps), { id: "M1", url: null });
});

test("publishInstagram does not call media_publish when the claim no longer holds", async () => {
  const { deps, calls } = fake([{ json: { id: "C1" } }, { json: { status_code: "FINISHED" } }]);
  await assert.rejects(
    publishInstagram(TOKEN, "IG", { text: "c", imageUrl: "u" }, deps, { beforePublish: async () => false }),
    (e: unknown) => e instanceof MetaGraphError && e.definite
  );
  assert.ok(!calls.some((c) => c.url.endsWith("/media_publish")));
});

test("publishFacebook does not post when the claim no longer holds", async () => {
  const { deps, calls } = fake([]);
  await assert.rejects(
    publishFacebook(TOKEN, "1", { text: "t", imageUrl: null, link: "l" }, deps, { beforePublish: async () => false }),
    (e: unknown) => e instanceof MetaGraphError && e.definite
  );
  assert.equal(calls.length, 0);
});

test("the worst-case Instagram publish ends well before a post is shown as UNKNOWN", async () => {
  const { GRAPH_TIMEOUT_MS, POLL_MS, MAX_POLLS } = await import("../lib/social/meta-graph");
  const { UNKNOWN_AFTER_MS } = await import("../lib/social/rules");
  const worstBeforePublish = GRAPH_TIMEOUT_MS * (1 + MAX_POLLS) + POLL_MS * (MAX_POLLS - 1);
  assert.ok(worstBeforePublish + GRAPH_TIMEOUT_MS < UNKNOWN_AFTER_MS * 0.7, `${worstBeforePublish} ms`);
});

test("verifyPage accepts a pasted Page token when Meta returns no access_token (the token is the Page itself)", async () => {
  const { deps } = fake([{ json: { name: "P" } }, { json: { id: "123456" } }]);
  assert.equal((await verifyPage(TOKEN, "123456", deps)).pageToken, TOKEN);
});

test("verifyPage refuses a token that cannot post as the Page", async () => {
  const { deps } = fake([{ json: { name: "P" } }, { json: { id: "999" } }]);
  await assert.rejects(verifyPage(TOKEN, "123456", deps), (e: unknown) => e instanceof MetaGraphError && /cannot post as this Page/.test(e.message));
});

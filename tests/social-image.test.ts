import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import sharp from "sharp";

import { cropBox, isLocalCover, loadLocalCover, toSocialJpeg } from "../lib/social/social-image";
import { articleShareUrl, linkedinIntentUrl, socialImageUrl, xIntentUrl } from "../lib/social/urls";

test("cropBox keeps ratios inside 0.8–1.91 untouched", () => {
  assert.deepEqual(cropBox(1600, 900), { left: 0, top: 0, width: 1600, height: 900 });
});

test("cropBox trims a too-wide image to 1.91", () => {
  assert.deepEqual(cropBox(4000, 1000), { left: 1045, top: 0, width: 1910, height: 1000 });
});

test("cropBox trims a too-tall image to 0.8", () => {
  assert.deepEqual(cropBox(1000, 2000), { left: 0, top: 375, width: 1000, height: 1250 });
});

test("toSocialJpeg returns a JPEG no wider than 1440", async () => {
  const png = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#3366aa" } }).png().toBuffer();
  const out = await toSocialJpeg(png);
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);
  const meta = await sharp(out).metadata();
  assert.ok((meta.width ?? 0) <= 1440);
  assert.equal(meta.format, "jpeg");
});

test("toSocialJpeg rejects an image over the pixel limit", async () => {
  const big = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
  await assert.rejects(toSocialJpeg(big));
});

test("only local /uploads covers are used", async () => {
  assert.equal(isLocalCover("https://x.com/a.png"), false);
  assert.equal(isLocalCover("//evil/a.png"), false);
  assert.equal(isLocalCover(null), false);
  assert.equal(isLocalCover("/uploads/sites/s/articles/a/cover-1.png"), true);
  assert.equal(await loadLocalCover("/uploads/../../etc/passwd"), null);
  assert.equal(await loadLocalCover("https://x.com/a.png"), null);
});

test("loadLocalCover reads a file under LOCAL_UPLOAD_DIR", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "social-img-"));
  await mkdir(path.join(dir, "sites", "s1"), { recursive: true });
  await writeFile(path.join(dir, "sites", "s1", "c.png"), Buffer.from("png-bytes"));
  const prev = process.env.LOCAL_UPLOAD_DIR;
  process.env.LOCAL_UPLOAD_DIR = dir;
  try {
    assert.equal((await loadLocalCover("/uploads/sites/s1/c.png"))?.toString(), "png-bytes");
    assert.equal(await loadLocalCover("/uploads/sites/s1/missing.png"), null);
  } finally {
    if (prev === undefined) delete process.env.LOCAL_UPLOAD_DIR;
    else process.env.LOCAL_UPLOAD_DIR = prev;
  }
});

test("articleShareUrl uses the client domain only when the proxy is verified", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://diyseo.online";
  assert.equal(articleShareUrl({ id: "s1", domain: "mycarplate.online", proxyVerifiedAt: new Date() }, "a-b"), "https://mycarplate.online/blog/a-b");
  assert.equal(articleShareUrl({ id: "s1", domain: "mycarplate.online", proxyVerifiedAt: null }, "a-b"), "https://diyseo.online/blog/s1/a-b");
  assert.equal(articleShareUrl({ id: "s1", domain: "nonsense", proxyVerifiedAt: new Date() }, "a-b"), "https://diyseo.online/blog/s1/a-b");
  assert.equal(articleShareUrl({ id: "s1", domain: "diyseo.online", proxyVerifiedAt: new Date() }, "a-b"), "https://diyseo.online/blog/s1/a-b");
});

test("socialImageUrl points at the public route with a cover version", () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://diyseo.online";
  assert.equal(socialImageUrl("s1", "a1", "cover-123.png"), "https://diyseo.online/api/public/sites/s1/social-image/a1?v=cover-123.png");
});

test("xIntentUrl and linkedinIntentUrl encode text and link", () => {
  assert.equal(xIntentUrl("Hola & más", "https://s/b?x=1"), "https://x.com/intent/post?text=Hola+%26+m%C3%A1s&url=https%3A%2F%2Fs%2Fb%3Fx%3D1");
  assert.equal(linkedinIntentUrl("Hola", "https://s/b"), "https://www.linkedin.com/feed/?shareActive=true&text=Hola%0A%0Ahttps%3A%2F%2Fs%2Fb");
});

test("toSocialJpeg handles an EXIF-rotated photo (orientation 6)", async () => {
  const rotated = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#884422" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const out = await toSocialJpeg(rotated);
  const meta = await sharp(out).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 1000);
});

test("linkedinIntentUrl does not repeat a link the text already ends with", () => {
  assert.equal(linkedinIntentUrl("Read it\n\nhttps://s/b", "https://s/b"), "https://www.linkedin.com/feed/?shareActive=true&text=Read+it%0A%0Ahttps%3A%2F%2Fs%2Fb");
});

test("withLink appends the link only when the text does not contain it", async () => {
  const { withLink } = await import("../lib/social/urls");
  assert.equal(withLink("Hi", "https://s/b"), "Hi\n\nhttps://s/b");
  assert.equal(withLink("Hi https://s/b", "https://s/b"), "Hi https://s/b");
});

test("the social image is served only for the current cover version", async () => {
  const { isCurrentCoverVersion } = await import("../lib/social/urls");
  assert.equal(isCurrentCoverVersion("/uploads/sites/s/articles/a/cover-1.png", "cover-1.png"), true);
  assert.equal(isCurrentCoverVersion("/uploads/sites/s/articles/a/cover-1.png", "cover-2.png"), false);
  assert.equal(isCurrentCoverVersion("/uploads/sites/s/articles/a/cover-1.png", null), false);
});

test("a malformed escape in a cover URL is null, not an exception", async () => {
  assert.equal(await loadLocalCover("/uploads/%E0%A4%A"), null);
});

test("socialImageUrl is null when the app URL is not an absolute URL", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "";
  try {
    assert.equal(socialImageUrl("s1", "a1", "cover-1.png"), null);
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = prev;
  }
});

test("cachedSocialJpeg renders once per cover version and reuses the file", async () => {
  const { cachedSocialJpeg } = await import("../lib/social/social-image");
  const dir = await mkdtemp(path.join(tmpdir(), "social-cache-"));
  await mkdir(path.join(dir, "sites", "s1"), { recursive: true });
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#123456" } }).png().toBuffer();
  await writeFile(path.join(dir, "sites", "s1", "c.png"), png);
  const prev = process.env.LOCAL_UPLOAD_DIR;
  process.env.LOCAL_UPLOAD_DIR = dir;
  try {
    let renders = 0;
    const render = async (b: Buffer) => {
      renders++;
      return toSocialJpeg(b);
    };
    const a = await cachedSocialJpeg("/uploads/sites/s1/c.png", "art1", render);
    const b = await cachedSocialJpeg("/uploads/sites/s1/c.png", "art1", render);
    assert.ok(a && b && a.equals(b));
    assert.equal(renders, 1);
  } finally {
    if (prev === undefined) delete process.env.LOCAL_UPLOAD_DIR;
    else process.env.LOCAL_UPLOAD_DIR = prev;
  }
});

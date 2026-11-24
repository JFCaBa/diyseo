import assert from "node:assert/strict";
import { test } from "node:test";

import { createT } from "@/lib/i18n/translate";
import { localizeExportError, localizeProxyResult } from "@/lib/install-methods/localize";
import { buildStaticExport, EXPORT_LIMITS, ExportError } from "@/lib/install-methods/static-export";
import { evaluateBlogHtml, evaluateProxyResponse, verifyProxy, type ProxyResult } from "@/lib/install-methods/verify-proxy";

const en = createT("en");
const es = createT("es");
const HOST = "client.com";
const SITE = "site_1";
const goodHtml = `<meta name="diyseo-site" content="${SITE}"><link rel="canonical" href="https://${HOST}/blog">`;

const proxyCases: ProxyResult[] = [
  evaluateProxyResponse({ status: 404, body: "", host: HOST, siteId: SITE }),
  evaluateProxyResponse({ status: 301, body: "", host: HOST, siteId: SITE }),
  evaluateProxyResponse({ status: 503, body: "", host: HOST, siteId: SITE }),
  evaluateProxyResponse({ status: 200, body: "<html></html>", host: HOST, siteId: SITE }),
  evaluateProxyResponse({ status: 200, body: goodHtml, host: HOST, siteId: "other" }),
  evaluateProxyResponse({ status: 200, body: goodHtml.replace(HOST, "diyseo.online"), host: HOST, siteId: SITE }),
  evaluateProxyResponse({ status: 200, body: goodHtml, host: HOST, siteId: SITE })
];

test("proxy results: English output equals the original message, Spanish differs and keeps runtime values", () => {
  const unreachable = verifyProxy(HOST, SITE, {
    fetchOnce: async () => {
      throw new Error("boom");
    }
  });
  return Promise.all([unreachable, verifyProxy("localhost", SITE)]).then(([unreachableResult, invalid]) => {
    for (const result of [...proxyCases, unreachableResult, invalid]) {
      assert.equal(localizeProxyResult(en, result, HOST), result.message);
      const spanish = localizeProxyResult(es, result, HOST);
      assert.notEqual(spanish, result.message);
    }
    const bad = proxyCases[2];
    assert.match(localizeProxyResult(es, bad, HOST), /503/);
    assert.match(localizeProxyResult(es, proxyCases[0], HOST), /client\.com\/blog/);
  });
});

test("blogNotRendered nests the localized proxy check", () => {
  const check = evaluateBlogHtml({ body: "<html></html>", host: HOST, siteId: SITE });
  const error = new ExportError(`The blog could not be rendered for ${HOST}: ${check.message}`, "blogNotRendered", { host: HOST }, check);
  assert.equal(localizeExportError(en, error), error.message);
  assert.match(localizeExportError(es, error), /client\.com/);
  assert.match(localizeExportError(es, error), /no es una página de DIYSEO/);
});

async function exportError(slugs: string[], status = 200): Promise<ExportError> {
  try {
    await buildStaticExport({
      host: HOST,
      siteId: SITE,
      slugs,
      origin: "https://app.test",
      fetchImpl: async () => new Response("x", { status })
    });
  } catch (error) {
    assert.ok(error instanceof ExportError);
    return error;
  }
  throw new Error("expected an ExportError");
}

test("export errors: English output equals the original message, Spanish keeps the runtime values", async () => {
  const tooMany = await exportError(Array.from({ length: EXPORT_LIMITS.maxArticles + 1 }, (_, i) => `a-${i}`));
  const badSlug = await exportError(["../x"]);
  const pageStatus = await exportError(["post-one"], 500);

  for (const error of [tooMany, badSlug, pageStatus]) {
    assert.ok(error.code, error.message);
    assert.equal(localizeExportError(en, error), error.message);
    assert.notEqual(localizeExportError(es, error), error.message);
  }
  assert.match(localizeExportError(es, tooMany), /200/);
  assert.match(localizeExportError(es, tooMany), /201/);
  assert.match(localizeExportError(es, badSlug), /\.\.\/x/);
  assert.match(localizeExportError(es, pageStatus), /500/);
});

test("an ExportError without a code falls back to its English message", () => {
  const error = new ExportError("Something else");
  assert.equal(localizeExportError(es, error), "Something else");
});

test("social blockers: English output equals the original message, Spanish differs and keeps the limit", async () => {
  const { blockerMessage, textBlockerFor } = await import("@/lib/social/rules");
  const { localizeBlocker } = await import("@/lib/social/localize");
  const codes = [
    "textEmpty",
    "textTooLong",
    "instagramHashtags",
    "openNetwork",
    "publishArticleFirst",
    "alreadyPublished",
    "publishing",
    "connectPage",
    "noInstagram",
    "needsCover"
  ] as const;
  for (const code of codes) {
    const blocker = { code, limit: 280 };
    assert.equal(localizeBlocker(en, blocker), blockerMessage(blocker));
    assert.notEqual(localizeBlocker(es, blocker), blockerMessage(blocker));
  }
  const tooLong = textBlockerFor("X", "a".repeat(300));
  assert.ok(tooLong);
  assert.match(localizeBlocker(es, tooLong), new RegExp(String(tooLong.limit)));
});

test("stored post errors: unknown-result wrapper is translated, Meta text stays verbatim", async () => {
  const { localizeStoredPostError } = await import("@/lib/social/localize");
  const { createLocalizeMessage } = await import("@/lib/i18n/translate");
  const lm = createLocalizeMessage("es");
  assert.equal(localizeStoredPostError(es, lm, "Unknown result: (#368) Rate limited"), "Resultado desconocido: (#368) Rate limited");
  assert.equal(localizeStoredPostError(es, lm, "Unknown result: Unexpected error while publishing"), "Resultado desconocido: Error inesperado al publicar");
  assert.equal(localizeStoredPostError(es, lm, "(#200) Permissions error"), "(#200) Permissions error");
  assert.equal(localizeStoredPostError(en, createLocalizeMessage("en"), "Unknown result: x"), "Unknown result: x");
});

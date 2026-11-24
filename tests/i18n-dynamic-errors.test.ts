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

import { localizeProviderError } from "@/lib/analytics-errors";
import { createLocalizeMessage } from "@/lib/i18n/translate";
import { ProviderHttpError } from "@/lib/provider-error";

test("provider HTTP errors: English equals the original message, Spanish is translated and keeps status", () => {
  const cases = [
    new ProviderHttpError("googleRefresh", 400, "invalid_grant", "Google token refresh failed: 400 invalid_grant"),
    new ProviderHttpError("sitesList", 403, "denied", "Search Console sites.list failed: 403 denied"),
    new ProviderHttpError("searchAnalyticsQuery", 500, "boom", "Search Console searchAnalytics.query failed: 500 boom"),
    new ProviderHttpError("serperSearch", 429, "slow down", "Serper search failed: 429 slow down")
  ];
  for (const error of cases) {
    assert.equal(localizeProviderError(en, createLocalizeMessage("en"), error, "x"), error.message);
    const spanish = localizeProviderError(es, createLocalizeMessage("es"), error, "x");
    assert.notEqual(spanish, error.message);
    assert.ok(spanish.includes(String(error.status)));
    assert.ok(spanish.includes(error.detail));
  }
});

test("provider errors: static lib errors are translated by catalog, unknown errors pass through", () => {
  const es2 = createLocalizeMessage("es");
  assert.match(localizeProviderError(es, es2, new Error("Google OAuth credentials are not configured."), "x"), /Google OAuth/);
  assert.notEqual(localizeProviderError(es, es2, new Error("Google OAuth credentials are not configured."), "x"), "Google OAuth credentials are not configured.");
  assert.equal(localizeProviderError(es, es2, new Error("weird thing"), "x"), "weird thing");
  assert.equal(localizeProviderError(es, es2, "not an error", "fallback"), "fallback");
});

import { localizeQuotaError } from "@/lib/quota-errors";
import { QuotaError } from "@/lib/quota-error";

test("quota errors: English output equals the original message, Spanish differs and keeps plan and limit", () => {
  const lm = createLocalizeMessage("es");
  const cases = [
    new QuotaError("Your trial has ended. Choose a plan at /billing to keep generating articles.", "trialEndedArticles"),
    new QuotaError(
      "You have used all 12 AI articles included in your starter plan this month. Upgrade at /billing or wait until next month.",
      "articlesExhausted",
      { limit: 12, plan: "starter" }
    ),
    new QuotaError("AI translations are included in the Pro and Agency plans. Upgrade at /billing.", "translationsNotIncluded"),
    new QuotaError("Your trial has ended. Choose a plan at /billing to add sites.", "trialEndedSites"),
    new QuotaError("Your starter plan includes 1 site. Upgrade at /billing to add more.", "sitesLimit", { limit: 1, plan: "starter" }),
    new QuotaError("Your pro plan includes 3 sites. Upgrade at /billing to add more.", "sitesLimit", { limit: 3, plan: "pro" })
  ];
  for (const error of cases) {
    assert.equal(localizeQuotaError(en, createLocalizeMessage("en"), error), error.message);
    assert.notEqual(localizeQuotaError(es, lm, error), error.message);
  }
  assert.match(localizeQuotaError(es, lm, cases[1]), /12/);
  assert.match(localizeQuotaError(es, lm, cases[1]), /starter/);
  assert.match(localizeQuotaError(es, lm, cases[5]), /3 sitios/);
  assert.match(localizeQuotaError(es, lm, cases[4]), /1 sitio\b/);
});

test("quota errors: other errors go through the static catalog, non-errors give an empty string", () => {
  const lm = createLocalizeMessage("es");
  assert.equal(localizeQuotaError(es, lm, new Error("odd")), "odd");
  assert.equal(localizeQuotaError(es, lm, "nope"), "");
});

test("team: the member-limit and already-member texts keep their runtime values", () => {
  assert.equal(en("team.alreadyMember", { email: "a@b.co" }), "a@b.co is already on this team.");
  assert.match(es("team.alreadyMember", { email: "a@b.co" }), /a@b\.co/);
  assert.match(es("team.limitOther", { limit: 3, billing: "x" }), /3/);
  assert.match(es("team.limitOne", { limit: 1, billing: "x" }), /1 miembro\b/);
});

import { formatPriceGbp } from "@/lib/i18n/translate";
import { es as esMessages } from "@/lib/i18n/messages/es";

test("prices: English keeps £29, Spanish uses the narrow symbol, and the Spanish plan text matches the formatter", () => {
  assert.equal(formatPriceGbp(29, "en"), "£29");
  assert.equal(formatPriceGbp(29, "es").replace(/\s/g, " "), "29 £");
  assert.ok(esMessages.billing.plans.agency.f1.includes(formatPriceGbp(15, "es").replace(/\s/g, " ")));
});

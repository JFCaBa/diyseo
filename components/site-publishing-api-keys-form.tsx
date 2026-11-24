"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocale, useLocalizeMessage, useT } from "@/components/i18n-provider";
import { type ActionState, createPublishingApiKey, revokePublishingApiKey } from "@/lib/actions";
import type { UiLocale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/i18n/translate";

const initialState: ActionState = {};

type PublishingApiKeyListItem = {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type SitePublishingApiKeysFormProps = {
  siteId: string;
  endpointUrl: string;
  initialKeys: PublishingApiKeyListItem[];
  showDocumentation?: boolean;
};

function CreateButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("apiKeys.creating") : t("apiKeys.create")}
    </button>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("apiKeys.revoking") : t("apiKeys.revoke")}
    </button>
  );
}

function formatDateTime(value: string | null, locale: UiLocale) {
  if (!value) {
    return "—";
  }

  return formatDate(value, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function RevokeKeyForm({ keyId, siteId }: { keyId: string; siteId: string }) {
  const revokePublishingApiKeyForSite = revokePublishingApiKey.bind(null, siteId);
  const localizeMessage = useLocalizeMessage();
  const [state, formAction] = useActionState(revokePublishingApiKeyForSite, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="keyId" value={keyId} />
      <RevokeButton />
      {state.error ? <p className="text-xs text-red-600">{localizeMessage(state.error)}</p> : null}
    </form>
  );
}

export function SitePublishingApiKeysForm({
  siteId,
  endpointUrl,
  initialKeys,
  showDocumentation = false
}: SitePublishingApiKeysFormProps) {
  const t = useT();
  const locale = useLocale();
  const localizeMessage = useLocalizeMessage();
  const createPublishingApiKeyForSite = createPublishingApiKey.bind(null, siteId);
  const [state, formAction] = useActionState(createPublishingApiKeyForSite, initialState);
  const [label, setLabel] = useState(t("apiKeys.defaultLabel"));
  const singleEndpointUrl = useMemo(() => `${endpointUrl}/<idOrSlug>`, [endpointUrl]);
  const draftExample = useMemo(
    () => `curl -X POST '${endpointUrl}' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>' \\
  -H 'Content-Type: application/json' \\
  --data '{
    "title": "Draft article from API",
    "contentMarkdown": "# Draft article\\n\\nThis article was created as a draft via the publishing API."
  }'`,
    [endpointUrl]
  );
  const publishedExample = useMemo(
    () => `curl -X POST '${endpointUrl}' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>' \\
  -H 'Content-Type: application/json' \\
  --data '{
    "title": "Published article from API",
    "slug": "published-article-from-api",
    "contentMarkdown": "# Published article\\n\\nThis article was published via the publishing API.",
    "status": "PUBLISHED",
    "generateCoverImage": true
  }'`,
    [endpointUrl]
  );
  const responseExample = useMemo(
    () => `{
  "id": "clx123example",
  "title": "Published article from API",
  "slug": "published-article-from-api",
  "status": "PUBLISHED",
  "publishedAt": "2026-04-29T10:30:00.000Z",
  "publicUrl": "https://your-app.example.com/blog/${siteId}/published-article-from-api",
  "editorUrl": "https://your-app.example.com/${siteId}/articles/clx123example"
}`,
    [siteId]
  );
  const listExample = useMemo(
    () => `curl '${endpointUrl}?status=PUBLISHED&limit=20' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>'`,
    [endpointUrl]
  );
  const listResponseExample = useMemo(
    () => `{
  "siteId": "${siteId}",
  "articles": [
    {
      "id": "clx123example",
      "title": "Published article from API",
      "slug": "published-article-from-api",
      "excerpt": null,
      "coverImageUrl": null,
      "seoTitle": null,
      "seoDescription": null,
      "status": "PUBLISHED",
      "publishedAt": "2026-04-29T10:30:00.000Z",
      "createdAt": "2026-04-29T10:30:00.000Z",
      "updatedAt": "2026-04-29T10:30:00.000Z",
      "publicUrl": "https://your-app.example.com/blog/${siteId}/published-article-from-api",
      "editorUrl": "https://your-app.example.com/${siteId}/articles/clx123example"
    }
  ],
  "nextCursor": "MjAyNi0wNC0yOVQxMDozMDowMC4wMDBafGNseDEyM2V4YW1wbGU"
}`,
    [siteId]
  );
  const getSingleExample = useMemo(
    () => `curl '${endpointUrl}/published-article-from-api' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>'`,
    [endpointUrl]
  );
  const patchExample = useMemo(
    () => `curl -X PATCH '${endpointUrl}/published-article-from-api' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>' \\
  -H 'Content-Type: application/json' \\
  --data '{
    "title": "Updated title",
    "status": "PUBLISHED"
  }'`,
    [endpointUrl]
  );
  const putExample = useMemo(
    () => `curl -X PUT '${endpointUrl}/published-article-from-api' \\
  -H 'Authorization: Bearer <SITE_PUBLISHING_KEY>' \\
  -H 'Content-Type: application/json' \\
  --data '{
    "title": "Replacement title",
    "contentMarkdown": "# Replacement content\\n\\nFull replace via PUT.",
    "status": "PUBLISHED"
  }'`,
    [endpointUrl]
  );

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("apiKeys.eyebrow")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{t("apiKeys.title")}</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>{t("apiKeys.intro1")}</p>
          <p>{t("apiKeys.intro2")}</p>
          <p>{t("apiKeys.intro3")}</p>
        </div>
      </div>

      <form action={formAction} className="mt-6 grid gap-4 md:max-w-2xl">
        <div className="grid gap-2">
          <label htmlFor="publishingApiKeyLabel" className="text-sm font-semibold text-ink">
            {t("apiKeys.labelField")}
          </label>
          <input
            id="publishingApiKeyLabel"
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}

        {state.apiKeySecret ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">{t("apiKeys.copyTitle")}</p>
            <p className="mt-1 text-sm text-emerald-800">{t("apiKeys.copyHint")}</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-white px-4 py-3 text-sm text-ink">{state.apiKeySecret}</pre>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <CreateButton />
        </div>
      </form>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-ink">{t("apiKeys.existing")}</h3>
        {initialKeys.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{t("apiKeys.none")}</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line">
            <div className="grid grid-cols-[minmax(0,1.2fr)_150px_170px_170px_120px] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <p>{t("apiKeys.colLabel")}</p>
              <p>{t("apiKeys.colPrefix")}</p>
              <p>{t("apiKeys.colCreated")}</p>
              <p>{t("apiKeys.colLastUsed")}</p>
              <p className="text-right">{t("apiKeys.colActions")}</p>
            </div>
            <div className="divide-y divide-line">
              {initialKeys.map((key) => (
                <div key={key.id} className="grid items-center gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_150px_170px_170px_120px]">
                  <div>
                    <p className="font-semibold text-ink">{key.label}</p>
                    <p className="text-xs text-slate-500">{key.revokedAt ? t("apiKeys.revoked") : t("apiKeys.active")}</p>
                  </div>
                  <p className="text-sm text-slate-600">{key.keyPrefix}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(key.createdAt, locale)}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(key.lastUsedAt, locale)}</p>
                  <div className="flex justify-start md:justify-end">
                    {key.revokedAt ? (
                      <span className="text-sm font-semibold text-slate-400">{t("apiKeys.revoked")}</span>
                    ) : (
                      <RevokeKeyForm keyId={key.id} siteId={siteId} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showDocumentation ? (
        <div className="mt-8 grid gap-8">
          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-lg font-semibold text-ink">{t("apiKeys.docs.title")}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("apiKeys.docs.intro")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.baseUrl")}</p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
{endpointUrl}
                </pre>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.authentication")}</p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
Authorization: Bearer &lt;SITE_PUBLISHING_KEY&gt;
                </pre>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.endpoints")}</p>
              <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
{`POST   ${endpointUrl}                ${t("apiKeys.docs.endpointCreate")}
GET    ${endpointUrl}                ${t("apiKeys.docs.endpointList")}
GET    ${singleEndpointUrl}    ${t("apiKeys.docs.endpointFetch")}
PATCH  ${singleEndpointUrl}    ${t("apiKeys.docs.endpointPatch")}
PUT    ${singleEndpointUrl}    ${t("apiKeys.docs.endpointPut")}`}
              </pre>
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">{`POST ${endpointUrl}`}</h3>
              <p className="mt-1 text-sm text-slate-600">{t("apiKeys.docs.createIntro")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.requiredFields")}</p>
                <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                  <p>{"`title`"}</p>
                  <p>{"`contentMarkdown`"}</p>
                </div>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.optionalFields")}</p>
                <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                  <p>{"`slug`, `excerpt`, `coverImageUrl`"}</p>
                  <p>{"`status`, `publishedAt`"}</p>
                  <p>{"`seoTitle`, `seoDescription`"}</p>
                  <p>{"`generateCoverImage`"}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{t("apiKeys.docs.statusBehavior")}</p>
                <p className="mt-2">{t("apiKeys.docs.statusDefault")}</p>
                <p>{t("apiKeys.docs.statusPublished")}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{t("apiKeys.docs.slugBehavior")}</p>
                <p className="mt-2">{t("apiKeys.docs.slugGenerated")}</p>
                <p>{t("apiKeys.docs.slugUnique")}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-ink">{t("apiKeys.docs.coverTitle")}</p>
              <p className="mt-2">{t("apiKeys.docs.coverSet")}</p>
              <p>{t("apiKeys.docs.coverAsync")}</p>
              <p>{t("apiKeys.docs.coverExclusive")}</p>
            </div>

            <div className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.createDraft")}</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{draftExample}</pre>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.createPublished")}</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{publishedExample}</pre>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.responseCreated")}</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{responseExample}</pre>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">{`GET ${endpointUrl}`}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("apiKeys.docs.listIntro")}
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.queryParameters")}</p>
              <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                <p>{t("apiKeys.docs.queryStatus")}</p>
                <p>{t("apiKeys.docs.queryLimit")}</p>
                <p>{t("apiKeys.docs.queryCursor")}</p>
                <p>{t("apiKeys.docs.queryInclude")}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-ink">{t("apiKeys.docs.pagination")}</p>
              <p className="mt-2">{t("apiKeys.docs.paginationBody")}</p>
            </div>

            <div className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.exampleRequest")}</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{listExample}</pre>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.exampleResponse")}</p>
                <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{listResponseExample}</pre>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">{`GET ${singleEndpointUrl}`}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("apiKeys.docs.getOneIntro")}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.exampleRequest")}</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{getSingleExample}</pre>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
              <p>{t("apiKeys.docs.getOneNotFound")}</p>
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">{`PATCH ${singleEndpointUrl}`}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("apiKeys.docs.patchIntro")}
              </p>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.updatableFields")}</p>
              <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                <p>{"`title`, `excerpt`, `coverImageUrl`"}</p>
                <p>{t("apiKeys.docs.patchMarkdown")}</p>
                <p>{"`seoTitle`, `seoDescription`"}</p>
                <p>{"`status`, `publishedAt`"}</p>
                <p>{t("apiKeys.docs.patchCover")}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{t("apiKeys.docs.slugImmutable")}</p>
                <p className="mt-2">{t("apiKeys.docs.slugImmutableBody")}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{t("apiKeys.docs.statusTransitions")}</p>
                <p className="mt-2">{t("apiKeys.docs.transitionPublished")}</p>
                <p>{t("apiKeys.docs.transitionDraft")}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.exampleRequest")}</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{patchExample}</pre>
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-line bg-mist/30 p-6">
            <div>
              <h3 className="text-base font-semibold text-ink">{`PUT ${singleEndpointUrl}`}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("apiKeys.docs.putIntro")}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{t("apiKeys.docs.exampleRequest")}</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white px-4 py-4 text-xs text-ink">{putExample}</pre>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { type ActionState, createPublishingApiKey, revokePublishingApiKey } from "@/lib/actions";

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

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Creating..." : "Create publishing API key"}
    </button>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Revoking..." : "Revoke"}
    </button>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function RevokeKeyForm({ keyId, siteId }: { keyId: string; siteId: string }) {
  const revokePublishingApiKeyForSite = revokePublishingApiKey.bind(null, siteId);
  const [state, formAction] = useActionState(revokePublishingApiKeyForSite, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="keyId" value={keyId} />
      <RevokeButton />
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function SitePublishingApiKeysForm({
  siteId,
  endpointUrl,
  initialKeys,
  showDocumentation = false
}: SitePublishingApiKeysFormProps) {
  const createPublishingApiKeyForSite = createPublishingApiKey.bind(null, siteId);
  const [state, formAction] = useActionState(createPublishingApiKeyForSite, initialState);
  const [label, setLabel] = useState("Primary publishing key");
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
    "status": "PUBLISHED"
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

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Publishing API</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Site publishing API keys</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>Keys can publish articles into this site.</p>
          <p>Raw keys are shown only once.</p>
          <p>Store them securely and revoke any key that may have been exposed.</p>
        </div>
      </div>

      <form action={formAction} className="mt-6 grid gap-4 md:max-w-2xl">
        <div className="grid gap-2">
          <label htmlFor="publishingApiKeyLabel" className="text-sm font-semibold text-ink">
            Key label
          </label>
          <input
            id="publishingApiKeyLabel"
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

        {state.apiKeySecret ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Copy this key now</p>
            <p className="mt-1 text-sm text-emerald-800">This secret will not be shown again after you leave this page.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-white px-4 py-3 text-sm text-ink">{state.apiKeySecret}</pre>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <CreateButton />
        </div>
      </form>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-ink">Existing keys</h3>
        {initialKeys.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No publishing API keys created yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line">
            <div className="grid grid-cols-[minmax(0,1.2fr)_150px_170px_170px_120px] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <p>Label</p>
              <p>Prefix</p>
              <p>Created</p>
              <p>Last used</p>
              <p className="text-right">Actions</p>
            </div>
            <div className="divide-y divide-line">
              {initialKeys.map((key) => (
                <div key={key.id} className="grid items-center gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_150px_170px_170px_120px]">
                  <div>
                    <p className="font-semibold text-ink">{key.label}</p>
                    <p className="text-xs text-slate-500">{key.revokedAt ? "Revoked" : "Active"}</p>
                  </div>
                  <p className="text-sm text-slate-600">{key.keyPrefix}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(key.createdAt)}</p>
                  <p className="text-sm text-slate-600">{formatDateTime(key.lastUsedAt)}</p>
                  <div className="flex justify-start md:justify-end">
                    {key.revokedAt ? (
                      <span className="text-sm font-semibold text-slate-400">Revoked</span>
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
              <h3 className="text-lg font-semibold text-ink">API documentation</h3>
              <p className="mt-1 text-sm text-slate-600">
                Use this endpoint to create draft or published articles directly inside this site.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Endpoint</p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
POST {endpointUrl}
                </pre>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Authentication</p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
Authorization: Bearer &lt;SITE_PUBLISHING_KEY&gt;
                </pre>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Content type</p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-white px-4 py-3 text-xs text-ink">
application/json
                </pre>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Required fields</p>
                <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                  <p>`title`</p>
                  <p>`contentMarkdown`</p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold text-ink">Optional fields</p>
              <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700">
                <p>`slug`</p>
                <p>`excerpt`</p>
                <p>`coverImageUrl`</p>
                <p>`status`</p>
                <p>`publishedAt`</p>
                <p>`seoTitle`</p>
                <p>`seoDescription`</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">Status behavior</p>
                <p className="mt-2">Default status is `DRAFT`.</p>
                <p>`PUBLISHED` sets `publishedAt` automatically if it is missing.</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">Slug behavior</p>
                <p className="mt-2">If `slug` is missing, it is generated from `title`.</p>
                <p>Existing slugs are made unique with `-2`, `-3`, and so on.</p>
              </div>
            </div>
          </section>

          <section className="grid gap-5">
            <div>
              <h3 className="text-sm font-semibold text-ink">Create draft article</h3>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-mist/50 px-4 py-4 text-xs text-ink">{draftExample}</pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Create published article</h3>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-mist/50 px-4 py-4 text-xs text-ink">{publishedExample}</pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Minimal response example</h3>
              <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-mist/50 px-4 py-4 text-xs text-ink">{responseExample}</pre>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

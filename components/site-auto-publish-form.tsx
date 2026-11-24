"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { generateNextAutoArticle, updateAutoPublishSettings, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

type SiteAutoPublishFormProps = {
  siteId: string;
  initialAutoPublishEnabled: boolean;
  initialArticlesPerWeek: number;
  initialRequireReview: boolean;
};

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("settings.saving") : t("settings.autoPublish.save")}
    </button>
  );
}

function GenerateButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("settings.autoPublish.generating") : t("settings.autoPublish.generate")}
    </button>
  );
}

export function SiteAutoPublishForm({
  siteId,
  initialAutoPublishEnabled,
  initialArticlesPerWeek,
  initialRequireReview
}: SiteAutoPublishFormProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const updateAutoPublishSettingsForSite = updateAutoPublishSettings.bind(null, siteId);
  const generateNextAutoArticleForSite = generateNextAutoArticle.bind(null, siteId);
  const [state, formAction] = useActionState(updateAutoPublishSettingsForSite, initialState);
  const [generationState, generationFormAction] = useActionState(generateNextAutoArticleForSite, initialState);
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(initialAutoPublishEnabled);
  const [articlesPerWeek, setArticlesPerWeek] = useState(String(initialArticlesPerWeek));
  const [requireReview, setRequireReview] = useState(initialRequireReview);

  useEffect(() => {
    setAutoPublishEnabled(initialAutoPublishEnabled);
    setArticlesPerWeek(String(initialArticlesPerWeek));
    setRequireReview(initialRequireReview);
  }, [initialAutoPublishEnabled, initialArticlesPerWeek, initialRequireReview]);

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("settings.autoPublish.eyebrow")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{t("settings.autoPublish.title")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("settings.autoPublish.intro")}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {t("settings.autoPublish.cronNote")}
        </p>
      </div>

      <form action={formAction} className="mt-6 grid gap-5 md:max-w-2xl">
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-mist/50 px-4 py-4">
          <div className="min-w-0">
            <label htmlFor="autoPublishEnabled" className="text-sm font-semibold text-ink">
              {t("settings.autoPublish.enableLabel")}
            </label>
            <p className="mt-1 text-sm text-slate-600">
              {t("settings.autoPublish.enableHint")}
            </p>
          </div>
          <input type="hidden" name="autoPublishEnabled" value={autoPublishEnabled ? "true" : "false"} />
          <button
            id="autoPublishEnabled"
            type="button"
            role="switch"
            aria-checked={autoPublishEnabled}
            onClick={() => setAutoPublishEnabled((current) => !current)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
              autoPublishEnabled ? "border-accent bg-accent" : "border-line bg-white"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                autoPublishEnabled ? "left-6" : "left-0.5"
              }`}
            />
            <span className="sr-only">{t("settings.autoPublish.enableLabel")}</span>
          </button>
        </div>

        <div className="grid gap-2">
          <label htmlFor="articlesPerWeek" className="text-sm font-semibold text-ink">
            {t("settings.autoPublish.perWeek")}
          </label>
          <input
            id="articlesPerWeek"
            name="articlesPerWeek"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={articlesPerWeek}
            onChange={(event) => setArticlesPerWeek(event.target.value)}
            className="w-full max-w-xs rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          />
          <p className="text-xs text-slate-500">{t("settings.autoPublish.range")}</p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-mist/50 px-4 py-4">
          <div className="min-w-0">
            <label htmlFor="requireReview" className="text-sm font-semibold text-ink">
              {t("settings.autoPublish.reviewLabel")}
            </label>
            <p className="mt-1 text-sm text-slate-600">
              {t("settings.autoPublish.reviewHint")}
            </p>
          </div>
          <input type="hidden" name="requireReview" value={requireReview ? "true" : "false"} />
          <button
            id="requireReview"
            type="button"
            role="switch"
            aria-checked={requireReview}
            onClick={() => setRequireReview((current) => !current)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${
              requireReview ? "border-accent bg-accent" : "border-line bg-white"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                requireReview ? "left-6" : "left-0.5"
              }`}
            />
            <span className="sr-only">{t("settings.autoPublish.reviewLabel")}</span>
          </button>
        </div>

        {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton />
          <button
            type="button"
            onClick={() => {
              setAutoPublishEnabled(initialAutoPublishEnabled);
              setArticlesPerWeek(String(initialArticlesPerWeek));
              setRequireReview(initialRequireReview);
            }}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("settings.reset")}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-line bg-mist/50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-ink">{t("settings.autoPublish.manualTitle")}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t("settings.autoPublish.manualDescription")}
            </p>
          </div>
          <form action={generationFormAction}>
            <GenerateButton />
          </form>
        </div>

        {generationState.error ? <p className="mt-3 text-sm text-red-600">{localizeMessage(generationState.error)}</p> : null}
        {!generationState.error && generationState.success ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <p className="text-accent">{localizeMessage(generationState.success)}</p>
            {generationState.generatedArticle ? (
              <Link
                href={`/${siteId}/articles/${generationState.generatedArticle.id}`}
                className="font-semibold text-accent hover:underline"
              >
                {generationState.generatedArticle.status === "PUBLISHED"
                  ? t("settings.autoPublish.openPublished")
                  : t("settings.autoPublish.openDraft")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

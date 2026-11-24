"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocale, useLocalizeMessage, useT } from "@/components/i18n-provider";
import { type ActionState, generateArticleTranslation } from "@/lib/actions";
import { formatDate } from "@/lib/i18n/translate";
import { getLocalizedTranslationLanguageLabel } from "@/lib/translations";

const initialState: ActionState = {};

type ArticleTranslationFormProps = {
  articleId: string;
  articleHasMarkdown: boolean;
  siteId: string;
  translationLanguages: string[];
  existingTranslations: Array<{
    language: string;
    updatedAt: string;
  }>;
};

function GenerateButton() {
  const t = useT();
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("editor.translation.generating") : t("editor.translation.generate")}
    </button>
  );
}

export function ArticleTranslationForm({
  articleId,
  articleHasMarkdown,
  siteId,
  translationLanguages,
  existingTranslations
}: ArticleTranslationFormProps) {
  const t = useT();
  const locale = useLocale();
  const localizeMessage = useLocalizeMessage();
  const formatUpdatedAt = (value: string) =>
    formatDate(value, locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const generateTranslationForArticle = generateArticleTranslation.bind(null, siteId, articleId);
  const [state, formAction] = useActionState(generateTranslationForArticle, initialState);
  const [language, setLanguage] = useState(translationLanguages[0] ?? "");
  const translationStatusByLanguage = useMemo(
    () => new Map(existingTranslations.map((translation) => [translation.language, translation.updatedAt])),
    [existingTranslations]
  );

  if (translationLanguages.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-5 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("editor.translation.eyebrow")}</p>
        <h2 className="text-2xl font-semibold text-ink">{t("editor.translation.title")}</h2>
        <p className="text-sm text-slate-600">
          {t("editor.translation.description")}
        </p>
      </div>

      <form action={formAction} className="grid gap-4 md:max-w-xl">
        <div className="grid gap-2">
          <label htmlFor="language" className="text-sm font-medium text-ink">
            {t("editor.translation.targetLanguage")}
          </label>
          <select
            id="language"
            name="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          >
            {translationLanguages.map((option) => (
              <option key={option} value={option}>
                {getLocalizedTranslationLanguageLabel(option, locale)} ({option})
              </option>
            ))}
          </select>
        </div>

        {!articleHasMarkdown ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("editor.translation.legacyHtml")}
          </p>
        ) : null}

        {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}

        <GenerateButton />
      </form>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-ink">{t("editor.translation.statusHeading")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {translationLanguages.map((code) => {
            const updatedAt = translationStatusByLanguage.get(code);

            return (
              <div key={code} className="rounded-2xl border border-line bg-mist/40 px-4 py-3 text-sm">
                <p className="font-semibold text-ink">
                  {getLocalizedTranslationLanguageLabel(code, locale)} <span className="font-normal text-slate-500">({code})</span>
                </p>
                <p className="mt-1 text-slate-600">{updatedAt ? t("editor.translation.updated", { date: formatUpdatedAt(updatedAt) }) : t("editor.translation.notGenerated")}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

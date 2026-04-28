"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { type ActionState, updateTranslationSettings } from "@/lib/actions";
import { TRANSLATION_LANGUAGE_OPTIONS } from "@/lib/translations";

const initialState: ActionState = {};

type SiteTranslationSettingsFormProps = {
  siteId: string;
  initialTranslationsEnabled: boolean;
  initialTranslationLanguages: string[];
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Saving..." : "Save translation settings"}
    </button>
  );
}

export function SiteTranslationSettingsForm({
  siteId,
  initialTranslationsEnabled,
  initialTranslationLanguages
}: SiteTranslationSettingsFormProps) {
  const updateTranslationSettingsForSite = updateTranslationSettings.bind(null, siteId);
  const [state, formAction] = useActionState(updateTranslationSettingsForSite, initialState);
  const [translationsEnabled, setTranslationsEnabled] = useState(initialTranslationsEnabled);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialTranslationLanguages);

  useEffect(() => {
    setTranslationsEnabled(initialTranslationsEnabled);
    setSelectedLanguages(initialTranslationLanguages);
  }, [initialTranslationsEnabled, initialTranslationLanguages]);

  function toggleLanguage(language: string) {
    setSelectedLanguages((current) =>
      current.includes(language) ? current.filter((value) => value !== language) : [...current, language].sort()
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Translations</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Multilingual article settings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Only enabled sites will generate translated article versions.
        </p>
      </div>

      <form action={formAction} className="mt-6 grid gap-5 md:max-w-3xl">
        <input type="hidden" name="translationsEnabled" value={translationsEnabled ? "true" : "false"} />
        {selectedLanguages.map((language) => (
          <input key={language} type="hidden" name="translationLanguages" value={language} />
        ))}

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-mist/40 px-4 py-4">
          <input
            type="checkbox"
            checked={translationsEnabled}
            onChange={(event) => setTranslationsEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-ink">Enable translations</span>
            <span className="block text-sm text-slate-600">
              When enabled, this site can generate article translations only for the selected target languages.
            </span>
          </span>
        </label>

        <fieldset className="grid gap-3" disabled={!translationsEnabled}>
          <legend className="text-sm font-semibold text-ink">Target languages</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRANSLATION_LANGUAGE_OPTIONS.map((option) => {
              const checked = selectedLanguages.includes(option.code);

              return (
                <label
                  key={option.code}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    translationsEnabled
                      ? checked
                        ? "border-accent bg-mist text-ink"
                        : "border-line bg-white text-ink hover:bg-mist"
                      : "border-line bg-slate-50 text-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLanguage(option.code)}
                    disabled={!translationsEnabled}
                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                  />
                  <span>
                    {option.label} <span className="text-slate-500">({option.code})</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton />
          <button
            type="button"
            onClick={() => {
              setTranslationsEnabled(initialTranslationsEnabled);
              setSelectedLanguages(initialTranslationLanguages);
            }}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}

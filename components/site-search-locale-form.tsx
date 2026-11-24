"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { type ActionState, updateSearchLocaleDefaults } from "@/lib/actions";
import { getSearchLocaleByValue, getSearchLocaleValue, SEARCH_LOCALE_OPTIONS } from "@/lib/search-locale";

const initialState: ActionState = {};

type SiteSearchLocaleFormProps = {
  initialDefaultSearchCountry: string;
  initialDefaultSearchLanguage: string;
  siteId: string;
};

const LOCALE_LABEL_KEYS = {
  "es-es": "settings.searchLocale.esEs",
  "us-en": "settings.searchLocale.usEn",
  "uk-en": "settings.searchLocale.ukEn",
  "fr-fr": "settings.searchLocale.frFr",
  "de-de": "settings.searchLocale.deDe",
  "it-it": "settings.searchLocale.itIt",
  "pt-pt": "settings.searchLocale.ptPt"
} as const;

function SaveButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("settings.saving") : t("settings.searchLocale.save")}
    </button>
  );
}

export function SiteSearchLocaleForm({
  siteId,
  initialDefaultSearchCountry,
  initialDefaultSearchLanguage
}: SiteSearchLocaleFormProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const updateSearchLocaleDefaultsForSite = updateSearchLocaleDefaults.bind(null, siteId);
  const [state, formAction] = useActionState(updateSearchLocaleDefaultsForSite, initialState);
  const [defaultSearchLocale, setDefaultSearchLocale] = useState<string>(
    getSearchLocaleValue(initialDefaultSearchCountry, initialDefaultSearchLanguage)
  );
  const selectedLocale = getSearchLocaleByValue(defaultSearchLocale);

  useEffect(() => {
    setDefaultSearchLocale(getSearchLocaleValue(initialDefaultSearchCountry, initialDefaultSearchLanguage));
  }, [initialDefaultSearchCountry, initialDefaultSearchLanguage]);

  return (
    <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("settings.searchLocale.eyebrow")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{t("settings.searchLocale.title")}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("settings.searchLocale.description")}
        </p>
      </div>

      <form action={formAction} className="mt-6 grid gap-5 md:max-w-2xl">
        <input type="hidden" name="defaultSearchCountry" value={selectedLocale.country} />
        <input type="hidden" name="defaultSearchLanguage" value={selectedLocale.language} />

        <div className="grid gap-2">
          <label htmlFor="defaultSearchLocale" className="text-sm font-semibold text-ink">
            {t("settings.searchLocale.label")}
          </label>
          <select
            id="defaultSearchLocale"
            value={defaultSearchLocale}
            onChange={(event) => setDefaultSearchLocale(event.target.value)}
            className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
          >
            {SEARCH_LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t("settings.searchLocale.option", {
                  label: t(LOCALE_LABEL_KEYS[option.value]),
                  country: option.country,
                  language: option.language
                })}
              </option>
            ))}
          </select>
        </div>

        {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
        {!state.error && state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton />
          <button
            type="button"
            onClick={() => {
              setDefaultSearchLocale(getSearchLocaleValue(initialDefaultSearchCountry, initialDefaultSearchLanguage));
            }}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("settings.reset")}
          </button>
        </div>
      </form>
    </section>
  );
}

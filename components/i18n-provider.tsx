"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { UiLocale } from "@/lib/i18n/locale";
import { createLocalizeMessage, createT, type LocalizeMessage, type T } from "@/lib/i18n/translate";

type I18nValue = { locale: UiLocale; t: T; localizeMessage: LocalizeMessage };

function i18nValue(locale: UiLocale): I18nValue {
  return { locale, t: createT(locale), localizeMessage: createLocalizeMessage(locale) };
}

/** Default is English, so a component rendered outside any provider stays English. */
const I18nContext = createContext<I18nValue>(i18nValue("en"));

/** Mounted by the signed-in layouts with the locale resolved on the server. */
export function I18nProvider({ locale, children }: { locale: UiLocale; children: ReactNode }) {
  const value = useMemo(() => i18nValue(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): T {
  return useContext(I18nContext).t;
}

export function useLocale(): UiLocale {
  return useContext(I18nContext).locale;
}

export function useLocalizeMessage(): LocalizeMessage {
  return useContext(I18nContext).localizeMessage;
}

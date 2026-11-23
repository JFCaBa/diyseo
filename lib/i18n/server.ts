import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";

import { resolveUiLocale, UI_LOCALE_COOKIE, type UiLocale } from "@/lib/i18n/locale";
import { createLocalizeMessage, createT, type LocalizeMessage, type T } from "@/lib/i18n/translate";

/** The request's UI locale: `diyseo-locale` cookie, else Accept-Language, else English. No DB. */
export const getUiLocale = cache(async (): Promise<UiLocale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveUiLocale({
    cookie: cookieStore.get(UI_LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language")
  });
});

export async function getT(): Promise<T> {
  return createT(await getUiLocale());
}

export async function getLocalizeMessage(): Promise<LocalizeMessage> {
  return createLocalizeMessage(await getUiLocale());
}

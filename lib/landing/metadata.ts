import type { Metadata } from "next";

import { getAppOrigin } from "@/lib/app-origin";
import { UI_LOCALES, type UiLocale } from "@/lib/i18n/locale";
import { LANDING_COPY, LANDING_PATH } from "@/lib/landing/copy";

/** Title, description, canonical and the hreflang set (every landing, `/` also as x-default), absolute from NEXT_PUBLIC_APP_URL. */
export function landingMetadata(locale: UiLocale): Metadata {
  const origin = getAppOrigin();
  const url = (path: string) => (origin ? `${origin}${path}` : path);
  const copy = LANDING_COPY[locale].meta;

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: url(LANDING_PATH[locale]),
      languages: { ...Object.fromEntries(UI_LOCALES.map((l) => [l, url(LANDING_PATH[l])])), "x-default": url(LANDING_PATH.en) }
    }
  };
}

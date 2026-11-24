import type { Metadata } from "next";

import { getAppOrigin } from "@/lib/app-origin";
import type { UiLocale } from "@/lib/i18n/locale";
import { LANDING_COPY, LANDING_PATH } from "@/lib/landing/copy";

/** Title, description, canonical and the hreflang pair (`/` en and x-default, `/es` es), absolute from NEXT_PUBLIC_APP_URL. */
export function landingMetadata(locale: UiLocale): Metadata {
  const origin = getAppOrigin();
  const url = (path: string) => (origin ? `${origin}${path}` : path);
  const copy = LANDING_COPY[locale].meta;

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: url(LANDING_PATH[locale]),
      languages: { en: url(LANDING_PATH.en), es: url(LANDING_PATH.es), "x-default": url(LANDING_PATH.en) }
    }
  };
}

/** UI language of the signed-in app. Pure: no Next imports, safe for client, server and tests. */
export type UiLocale = "en" | "es" | "pt";

export const UI_LOCALES: readonly UiLocale[] = ["en", "es", "pt"];

export const UI_LOCALE_COOKIE = "diyseo-locale";

const ONE_YEAR_SECONDS = 31_536_000;

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "es" || value === "pt";
}

/** Accept-Language entries whose primary tag is en/es/pt (pt-BR included), best first (q=0 and malformed entries dropped). */
function acceptedUiLocales(header: string): UiLocale[] {
  const entries: Array<{ locale: UiLocale; q: number; index: number }> = [];

  header.split(",").forEach((part, index) => {
    const [range, ...params] = part.split(";").map((piece) => piece.trim());
    const primary = range.split("-")[0].toLowerCase();
    if (!isUiLocale(primary)) return;

    let q = 1;
    for (const param of params) {
      const match = /^q\s*=\s*([0-9]+(?:\.[0-9]*)?)$/i.exec(param);
      if (match) q = Number(match[1]);
      else if (/^q\s*=/i.test(param)) q = Number.NaN;
    }
    if (!(q > 0 && q <= 1)) return;

    entries.push({ locale: primary, q, index });
  });

  return entries.sort((a, b) => b.q - a.q || a.index - b.index).map((entry) => entry.locale);
}

/** Valid cookie → best en/es/pt entry of Accept-Language (ties keep header order) → "en". */
export function resolveUiLocale(input: { cookie?: string | null; acceptLanguage?: string | null }): UiLocale {
  if (isUiLocale(input.cookie)) return input.cookie;
  return (input.acceptLanguage && acceptedUiLocales(input.acceptLanguage)[0]) || "en";
}

const INTL_LOCALE = { en: "en-US", es: "es-ES", pt: "pt-PT" } as const satisfies Record<UiLocale, string>;

export function intlLocale(locale: UiLocale): (typeof INTL_LOCALE)[UiLocale] {
  return INTL_LOCALE[locale];
}

/** The cookie the switcher sets, or null for anything that isn't a UiLocale. */
export function uiLocaleCookie(value: unknown, production: boolean) {
  if (!isUiLocale(value)) return null;
  return {
    name: UI_LOCALE_COOKIE,
    value,
    options: {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax" as const,
      httpOnly: true,
      secure: production
    }
  };
}

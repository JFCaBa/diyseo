export const DEFAULT_SEARCH_COUNTRY = "es";
export const DEFAULT_SEARCH_LANGUAGE = "es";

export const SEARCH_LOCALE_OPTIONS = [
  { value: "es-es", country: "es", language: "es", label: "Spain / Spanish" },
  { value: "us-en", country: "us", language: "en", label: "United States / English" },
  { value: "uk-en", country: "uk", language: "en", label: "United Kingdom / English" },
  { value: "fr-fr", country: "fr", language: "fr", label: "France / French" },
  { value: "de-de", country: "de", language: "de", label: "Germany / German" },
  { value: "it-it", country: "it", language: "it", label: "Italy / Italian" },
  { value: "pt-pt", country: "pt", language: "pt", label: "Portugal / Portuguese" }
] as const;

export const SEARCH_COUNTRY_OPTIONS = Array.from(
  new Map(SEARCH_LOCALE_OPTIONS.map((option) => [option.country, { value: option.country, label: option.label.split(" / ")[0] }])).values()
);

export const SEARCH_LANGUAGE_OPTIONS = Array.from(
  new Map(SEARCH_LOCALE_OPTIONS.map((option) => [option.language, { value: option.language, label: option.label.split(" / ")[1] }])).values()
);

export function normalizeSearchCountry(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SEARCH_COUNTRY_OPTIONS.some((option) => option.value === normalized) ? normalized : DEFAULT_SEARCH_COUNTRY;
}

export function normalizeSearchLanguage(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SEARCH_LANGUAGE_OPTIONS.some((option) => option.value === normalized) ? normalized : DEFAULT_SEARCH_LANGUAGE;
}

export function getSearchCountryLabel(value: string) {
  return SEARCH_COUNTRY_OPTIONS.find((option) => option.value === value)?.label ?? value.toUpperCase();
}

export function getSearchLanguageLabel(value: string) {
  return SEARCH_LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getSearchLocaleValue(country: string | null | undefined, language: string | null | undefined) {
  const normalizedCountry = normalizeSearchCountry(country);
  const normalizedLanguage = normalizeSearchLanguage(language);
  return (
    SEARCH_LOCALE_OPTIONS.find(
      (option) => option.country === normalizedCountry && option.language === normalizedLanguage
    )?.value ?? "es-es"
  );
}

export function getSearchLocaleByValue(value: string | null | undefined) {
  return SEARCH_LOCALE_OPTIONS.find((option) => option.value === value) ?? SEARCH_LOCALE_OPTIONS[0];
}

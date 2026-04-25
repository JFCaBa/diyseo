export const DEFAULT_SEARCH_COUNTRY = "es";
export const DEFAULT_SEARCH_LANGUAGE = "es";

export const SEARCH_COUNTRY_OPTIONS = [
  { value: "es", label: "Spain" },
  { value: "us", label: "United States" },
  { value: "gb", label: "United Kingdom" },
  { value: "fr", label: "France" },
  { value: "de", label: "Germany" },
  { value: "it", label: "Italy" },
  { value: "pt", label: "Portugal" },
  { value: "mx", label: "Mexico" },
  { value: "ar", label: "Argentina" },
  { value: "co", label: "Colombia" },
  { value: "cl", label: "Chile" }
] as const;

export const SEARCH_LANGUAGE_OPTIONS = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" }
] as const;

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

import { intlLocale, type UiLocale } from "@/lib/i18n/locale";

export const TRANSLATION_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" }
] as const;

export type TranslationLanguageCode = (typeof TRANSLATION_LANGUAGE_OPTIONS)[number]["code"];

const translationLanguageMap = new Map(TRANSLATION_LANGUAGE_OPTIONS.map((option) => [option.code, option]));

export function isSupportedTranslationLanguage(value: string | null | undefined): value is TranslationLanguageCode {
  return !!value && translationLanguageMap.has(value as TranslationLanguageCode);
}

export function getTranslationLanguageLabel(code: string) {
  return translationLanguageMap.get(code as TranslationLanguageCode)?.label ?? code;
}

/**
 * The language name in the UI language ("inglés" in Spanish). English keeps the existing label;
 * a code the runtime cannot name falls back to it too (and to the code itself when it is unknown).
 */
export function getLocalizedTranslationLanguageLabel(code: string, locale: UiLocale) {
  const fallback = getTranslationLanguageLabel(code);
  if (locale === "en" || !isSupportedTranslationLanguage(code)) return fallback;
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "language" }).of(code) || fallback;
  } catch {
    return fallback;
  }
}

export function normalizeTranslationLanguages(values: string[]) {
  return Array.from(new Set(values.filter((value): value is TranslationLanguageCode => isSupportedTranslationLanguage(value)))).sort();
}

export function parseTranslationLanguagesFromFormData(values: FormDataEntryValue[]) {
  return normalizeTranslationLanguages(
    values.map((value) => (typeof value === "string" ? value : "")).filter(Boolean)
  );
}

export function getRequestedTranslationLanguage(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isSupportedTranslationLanguage(normalized) ? normalized : null;
}

export function getTranslationQuerySuffix(language: string | null | undefined) {
  return language ? `?lang=${encodeURIComponent(language)}` : "";
}

export function pickArticleTranslation<
  T extends {
    translations?: Array<{
      language: string;
      title: string;
      excerpt: string | null;
      contentMarkdown: string;
      seoTitle: string | null;
      seoDescription: string | null;
    }>;
  }
>(
  article: T
) {
  return article.translations?.[0] ?? null;
}

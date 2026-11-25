import type { BlogLocale } from "@/lib/public-blog-i18n";

/**
 * Shared expectations for the content-language → blog-locale rule. Both
 * lib/public-blog-i18n.ts and the ES5 copy in public/embed.js are tested
 * against this table so the two implementations cannot drift apart.
 */
export const BLOG_LOCALE_CASES: ReadonlyArray<[input: string | null, expected: BlogLocale]> = [
  ["es", "es"],
  ["ES", "es"],
  [" es ", "es"],
  ["es-ES", "es"],
  ["es_MX", "es"],
  ["Spanish", "es"],
  ["Spanish (Spain)", "es"],
  ["español", "es"],
  ["Español - España", "es"],
  ["Espanol", "es"],
  ["castellano", "es"],
  ["pt", "pt"],
  ["PT", "pt"],
  ["pt-PT", "pt"],
  ["pt_BR", "pt"],
  ["Portuguese", "pt"],
  ["Português (Portugal)", "pt"],
  ["portugues", "pt"],
  ["portu", "en"],
  ["pol", "en"],
  [null, "en"],
  ["", "en"],
  ["en", "en"],
  ["fr", "en"],
  ["estonian", "en"],
  ["English", "en"],
  ["spa", "en"]
];

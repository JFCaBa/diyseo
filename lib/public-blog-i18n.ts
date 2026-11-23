/**
 * Language of the public blog chrome (titles, navigation, empty states, dates).
 * It follows the site's content language (BrandProfile.contentLanguage), which
 * is free text: codes like "es" / "es-ES" and names like "Spanish" or
 * "Español (España)" all resolve to Spanish. Anything else falls back to English.
 *
 * public/embed.js keeps an ES5 copy of resolveBlogLocale; both are tested
 * against tests/fixtures/blog-locale-cases.ts.
 */
export type BlogLocale = "en" | "es";

const SPANISH_NAMES = ["spanish", "español", "espanol", "castellano"];

export function resolveBlogLocale(contentLanguage: string | null | undefined): BlogLocale {
  const value = (contentLanguage ?? "").trim().toLowerCase();

  if (value === "es" || value.startsWith("es-") || value.startsWith("es_")) {
    return "es";
  }

  return SPANISH_NAMES.some((name) => value.startsWith(name)) ? "es" : "en";
}

export type BlogStrings = {
  blogTitle: (name: string) => string;
  indexDescription: (name: string) => string;
  eyebrow: string;
  indexIntro: (name: string) => string;
  emptyTitle: string;
  emptyBody: string;
  backToBlog: string;
  backToIndex: string;
  previous: string;
  next: string;
  articleNavLabel: string;
  published: (date: string) => string;
  viewingTranslation: (language: string) => string;
  headerBlogLink: string;
  sitemapLabel: string;
  feedDescription: (name: string) => string;
};

const STRINGS: Record<BlogLocale, BlogStrings> = {
  en: {
    blogTitle: (name) => `${name} Blog`,
    indexDescription: (name) => `Read the latest articles and updates from ${name}.`,
    eyebrow: "Public Blog",
    indexIntro: (name) => `Published articles from ${name}, served directly from the DIYSEO app.`,
    emptyTitle: "No articles published yet.",
    emptyBody: "Check back later for new posts from this site.",
    backToBlog: "← Back to Blog",
    backToIndex: "Back to Blog Index",
    previous: "Previous",
    next: "Next",
    articleNavLabel: "Article navigation",
    published: (date) => `Published ${date}`,
    viewingTranslation: (language) => `Viewing translation: ${language}`,
    headerBlogLink: "Blog",
    sitemapLabel: "Sitemap",
    feedDescription: (name) => `Latest articles from ${name}`
  },
  es: {
    blogTitle: (name) => `Blog de ${name}`,
    indexDescription: (name) => `Lee los últimos artículos y novedades de ${name}.`,
    eyebrow: "Blog",
    // Readers shouldn't see the vendor name, so no "served from DIYSEO" here.
    indexIntro: (name) => `Artículos publicados por ${name}.`,
    emptyTitle: "Todavía no hay artículos publicados.",
    emptyBody: "Vuelve pronto para leer las nuevas publicaciones.",
    backToBlog: "← Volver al blog",
    backToIndex: "Volver al índice del blog",
    previous: "Anterior",
    next: "Siguiente",
    articleNavLabel: "Navegación entre artículos",
    published: (date) => `Publicado el ${date}`,
    viewingTranslation: (language) => `Traducción: ${language}`,
    headerBlogLink: "Blog",
    sitemapLabel: "Mapa del sitio",
    feedDescription: (name) => `Últimos artículos de ${name}`
  }
};

export function getBlogStrings(locale: BlogLocale): BlogStrings {
  return STRINGS[locale];
}

export function formatBlogDate(date: Date | string, locale: BlogLocale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function blogHtmlLang(locale: BlogLocale): "en" | "es" {
  return locale;
}

export function blogOgLocale(locale: BlogLocale): "en_US" | "es_ES" {
  return locale === "es" ? "es_ES" : "en_US";
}

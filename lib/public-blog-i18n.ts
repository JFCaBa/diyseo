/**
 * Language of the public blog chrome (titles, navigation, empty states, dates).
 * It follows the site's content language (BrandProfile.contentLanguage), which
 * is free text: codes like "es" / "es-ES" and names like "Spanish" or
 * "Español (España)" all resolve to Spanish, and likewise "pt" / "pt-BR" /
 * "Português" to Portuguese. Anything else falls back to English.
 *
 * public/embed.js keeps an ES5 copy of resolveBlogLocale; both are tested
 * against tests/fixtures/blog-locale-cases.ts.
 */
export type BlogLocale = "en" | "es" | "pt";

const SPANISH_NAMES = ["spanish", "español", "espanol", "castellano"];
const PORTUGUESE_NAMES = ["portuguese", "português", "portugues"];

function isLanguage(value: string, code: string, names: string[]) {
  return value === code || value.startsWith(`${code}-`) || value.startsWith(`${code}_`) || names.some((name) => value.startsWith(name));
}

export function resolveBlogLocale(contentLanguage: string | null | undefined): BlogLocale {
  const value = (contentLanguage ?? "").trim().toLowerCase();

  if (isLanguage(value, "es", SPANISH_NAMES)) return "es";
  if (isLanguage(value, "pt", PORTUGUESE_NAMES)) return "pt";
  return "en";
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
  },
  pt: {
    blogTitle: (name) => `Blog de ${name}`,
    indexDescription: (name) => `Lê os artigos e novidades mais recentes de ${name}.`,
    eyebrow: "Blog",
    // Readers shouldn't see the vendor name, so no "served from DIYSEO" here.
    indexIntro: (name) => `Artigos publicados por ${name}.`,
    emptyTitle: "Ainda não há artigos publicados.",
    emptyBody: "Volta em breve para ler as novas publicações.",
    backToBlog: "← Voltar ao blog",
    backToIndex: "Voltar ao índice do blog",
    previous: "Anterior",
    next: "Seguinte",
    articleNavLabel: "Navegação entre artigos",
    published: (date) => `Publicado a ${date}`,
    viewingTranslation: (language) => `Tradução: ${language}`,
    headerBlogLink: "Blog",
    sitemapLabel: "Mapa do site",
    feedDescription: (name) => `Artigos mais recentes de ${name}`
  }
};

const DATE_LOCALE = { en: "en-US", es: "es-ES", pt: "pt-PT" } as const satisfies Record<BlogLocale, string>;
const OG_LOCALE = { en: "en_US", es: "es_ES", pt: "pt_PT" } as const satisfies Record<BlogLocale, string>;

export function getBlogStrings(locale: BlogLocale): BlogStrings {
  return STRINGS[locale];
}

export function formatBlogDate(date: Date | string, locale: BlogLocale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function blogHtmlLang(locale: BlogLocale): BlogLocale {
  return locale;
}

export function blogOgLocale(locale: BlogLocale): (typeof OG_LOCALE)[BlogLocale] {
  return OG_LOCALE[locale];
}

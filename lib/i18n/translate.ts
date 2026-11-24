import { intlLocale, type UiLocale } from "@/lib/i18n/locale";
import { en, type Messages } from "@/lib/i18n/messages/en";
import { es } from "@/lib/i18n/messages/es";

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Dotted path of every string in the dictionaries, e.g. "nav.dashboard". */
export type MessageKey = Leaves<typeof en>;

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type LocalizeMessage = (message: string | null | undefined) => string;

const DICTIONARIES: Record<UiLocale, Messages> = { en, es };

function flatten(tree: object, prefix = "", out = new Map<string, string>()) {
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out.set(`${prefix}${key}`, value);
    else flatten(value as object, `${prefix}${key}.`, out);
  }
  return out;
}

const flatCache = new Map<UiLocale, Map<string, string>>();

function flatMessages(locale: UiLocale) {
  let flat = flatCache.get(locale);
  if (!flat) {
    flat = flatten(DICTIONARIES[locale]);
    flatCache.set(locale, flat);
  }
  return flat;
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : placeholder
  );
}

/** `{var}` placeholders are filled from `vars`; a missing one stays visible as `{var}`. */
export function createT(locale: UiLocale): T {
  const messages = flatMessages(locale);
  const fallback = flatMessages("en");
  return (key, vars) => interpolate(messages.get(key) ?? fallback.get(key) ?? key, vars);
}

type CatalogName = "errors" | "notices";

/** English text → [catalog, key], over the closed `errors` and `notices` catalogs (values are unique, see tests). */
const CATALOG_KEYS = new Map<string, [CatalogName, string]>(
  (["errors", "notices"] as const).flatMap((catalog) =>
    Object.entries(en[catalog]).map(([key, value]) => [value, [catalog, key]] as [string, [CatalogName, string]])
  )
);

/**
 * Translates a static English message (Zod issue, static lib error or static action success) by
 * exact match against `en.errors` / `en.notices`; anything else is returned verbatim. Never use it for messages with runtime values.
 */
export function createLocalizeMessage(locale: UiLocale): LocalizeMessage {
  const dictionary = DICTIONARIES[locale];
  return (message) => {
    if (message === null || message === undefined) return "";
    const match = CATALOG_KEYS.get(message);
    if (!match) return message;
    const [catalog, key] = match;
    return (dictionary[catalog] as Record<string, string>)[key];
  };
}

export function formatDate(date: Date | string, locale: UiLocale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(typeof date === "string" ? new Date(date) : date);
}

export function formatNumber(value: number, locale: UiLocale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

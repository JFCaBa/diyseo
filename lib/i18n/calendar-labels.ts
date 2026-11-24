import { intlLocale, type UiLocale } from "@/lib/i18n/locale";

/** Short weekday names, Sunday first (display only; the grid's week start is unchanged). */
export function weekdayLabels(locale: UiLocale): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" });
  // 2023-01-01 is a Sunday.
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2023, 0, 1 + index))));
}

/** "November 2026" / "Noviembre de 2026": month and year heading in sentence case. */
export function monthHeading(month: Date, locale: UiLocale): string {
  const label = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  return label.charAt(0).toLocaleUpperCase(intlLocale(locale)) + label.slice(1);
}

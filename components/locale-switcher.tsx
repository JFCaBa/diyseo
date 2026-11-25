"use client";

import { useLocale, useT } from "@/components/i18n-provider";
import { setUiLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

/**
 * Submits on change; no optimistic update: the action's revalidation re-renders server and
 * client parts together in the new language.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useT();
  const locale = useLocale();

  return (
    <form action={setUiLocale} className={className}>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{t("localeSwitcher.label")}</span>
        <select
          key={locale}
          name="locale"
          defaultValue={locale}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={cn(
            "rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700",
            "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          )}
        >
          <option value="en">{t("localeSwitcher.en")}</option>
          <option value="es">{t("localeSwitcher.es")}</option>
          <option value="pt">{t("localeSwitcher.pt")}</option>
        </select>
      </label>
    </form>
  );
}

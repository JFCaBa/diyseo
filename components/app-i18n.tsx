import type { ReactNode } from "react";

import { I18nProvider } from "@/components/i18n-provider";
import { getUiLocale } from "@/lib/i18n/server";

/** Mounts the i18n provider with the request's locale, for signed-in pages that render client components. */
export async function AppI18n({ children }: { children: ReactNode }) {
  return <I18nProvider locale={await getUiLocale()}>{children}</I18nProvider>;
}

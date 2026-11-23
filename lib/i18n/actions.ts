"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { uiLocaleCookie } from "@/lib/i18n/locale";

/** Locale switcher: stores `locale` ("en" | "es"; anything else is ignored) and re-renders the app. */
export async function setUiLocale(formData: FormData): Promise<void> {
  const cookie = uiLocaleCookie(formData.get("locale"), process.env.NODE_ENV === "production");
  if (!cookie) return;

  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  revalidatePath("/", "layout");
}

"use server";

import { cookies } from "next/headers";

import { signIn } from "@/lib/auth";
import { uiLocaleCookie } from "@/lib/i18n/locale";

/** Landing CTAs: Google sign-in, then the workspace. Plans are chosen later in /billing. */
export async function startFreeTrial() {
  await signIn("google", { redirectTo: "/auth/continue" });
}

/** The `/es` CTAs: the app starts in Spanish (and so bills new customers in euros). */
export async function startFreeTrialEs() {
  const cookie = uiLocaleCookie("es", process.env.NODE_ENV === "production")!;
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  await signIn("google", { redirectTo: "/auth/continue" });
}

"use server";

import { signIn } from "@/lib/auth";

/** Landing CTAs: Google sign-in, then the workspace. Plans are chosen later in /billing. */
export async function startFreeTrial() {
  await signIn("google", { redirectTo: "/auth/continue" });
}

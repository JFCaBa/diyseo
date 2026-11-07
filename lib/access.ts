// Who may sign in and who uses DIYSEO for free. Edge-safe (no Prisma): used by
// auth.config.ts in middleware as well as on the server.
//
// ALLOWED_EMAILS: comma-separated emails that sign in at any time and get the
// complimentary plan. SIGNUP_OPEN=true lets anyone else sign in too (they get
// the trial). With no list and no flag, sign-in is open, as before.

type Env = Record<string, string | undefined>;

function listedEmails(env: Env) {
  return new Set(
    (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isListedEmail(email: string | null | undefined, env: Env = process.env): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized) && listedEmails(env).has(normalized!);
}

export function canSignIn(email: string | null | undefined, env: Env = process.env): boolean {
  if (!email?.trim()) {
    return false;
  }

  if (isListedEmail(email, env) || env.SIGNUP_OPEN === "true") {
    return true;
  }

  // No list and no explicit "false": open, as before this switch existed.
  return env.SIGNUP_OPEN !== "false" && listedEmails(env).size === 0;
}

/** The free plan never expires, so it gets no trial end date. */
export function trialEndForPlan(plan: "COMP" | "TRIAL", now: Date): Date | null {
  return plan === "COMP" ? null : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
}

export function planForNewWorkspace(email: string | null | undefined, env: Env = process.env): "COMP" | "TRIAL" {
  return isListedEmail(email, env) ? "COMP" : "TRIAL";
}

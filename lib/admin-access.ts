// Who may use /admin. Edge-safe (no Prisma), same style as lib/access.ts.
//
// ADMIN_EMAILS: comma-separated emails matched, case-insensitively, against the
// Google session email. Empty or unset means nobody is an admin.

type Env = Record<string, string | undefined>;

function adminEmails(env: Env) {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined, env: Env = process.env): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized) && adminEmails(env).has(normalized!);
}

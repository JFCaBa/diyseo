// Auth.js links a Google account once and does not refresh the stored tokens on
// later sign-ins. Search Console access is granted later (incremental consent),
// so every sign-in writes the new tokens back, through this rule.

const SEARCH_CONSOLE_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/webmasters"];

type ProviderAccount = {
  access_token?: string | null;
  expires_at?: number | null;
  scope?: string | null;
  refresh_token?: string | null;
  id_token?: string | null;
  token_type?: string | null;
};

const hasSearchConsole = (scope: string | null | undefined) =>
  (scope ?? "").split(/\s+/).some((granted) => SEARCH_CONSOLE_SCOPES.includes(granted));

/**
 * The fields to store for a fresh Google grant, or null to keep what is stored.
 * A sign-in whose token lacks a Search Console grant the stored token has is
 * ignored: overwriting would break Search Console until the user reconnects.
 * A missing refresh token keeps the stored one (Google only sends it on consent).
 */
export function accountTokenUpdate(account: ProviderAccount, storedScope?: string | null) {
  if (!account.access_token) {
    return null;
  }

  if (hasSearchConsole(storedScope) && !hasSearchConsole(account.scope)) {
    return null;
  }

  return {
    access_token: account.access_token,
    expires_at: account.expires_at ?? null,
    scope: account.scope ?? null,
    id_token: account.id_token ?? null,
    token_type: account.token_type ?? null,
    ...(account.refresh_token ? { refresh_token: account.refresh_token } : {})
  };
}

/** Host (no scheme, path or trailing slash) of a site's configured domain. The fallback is a UI placeholder; server code passes "". */
export function formatSiteHost(value?: string | null, fallback = "clientdomain.com"): string {
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).host.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

/**
 * A host the server may call during proxy verification: a plain DNS name with
 * at least one dot, no port, no IP literal, no obviously internal suffix.
 * This is the first SSRF layer; the connect-time address check is the second.
 */
export function isVerifiableHost(host: string): boolean {
  const value = host.trim().toLowerCase();

  if (!value || value.length > 253) {
    return false;
  }

  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    return false;
  }

  if (value === "localhost" || BLOCKED_SUFFIXES.some((suffix) => value.endsWith(suffix))) {
    return false;
  }

  return true;
}

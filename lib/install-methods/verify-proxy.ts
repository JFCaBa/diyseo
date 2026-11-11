import dns from "node:dns";
import https from "node:https";
import net from "node:net";

import { isVerifiableHost } from "@/lib/install-methods/site-host";

export type ProxyFailure =
  | "invalid_host"
  | "unreachable"
  | "not_found"
  | "redirect"
  | "bad_status"
  | "not_diyseo"
  | "wrong_site"
  | "forwarded_host_missing";

export type ProxyResult = { ok: true; message: string } | { ok: false; reason: ProxyFailure; message: string };

const DEADLINE_MS = 8_000;
const MAX_BODY_BYTES = 1_000_000;

function ipv4ToInt(ip: string) {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3]
];

function isBlockedV4(ip: string) {
  const value = ipv4ToInt(ip);

  return BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = Math.floor(ipv4ToInt(base) / size) * size;
    return value >= start && value < start + size;
  });
}

/** True only for a globally routable unicast address. Everything else is refused. */
export function isPublicAddress(ip: string): boolean {
  const version = net.isIP(ip);

  if (version === 4) {
    return !isBlockedV4(ip);
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

    if (mapped) {
      return !isBlockedV4(mapped[1]);
    }

    if (lower === "::" || lower === "::1" || lower.startsWith("::ffff:")) {
      return false;
    }

    const firstGroup = parseInt(lower.split(":")[0] || "0", 16);

    // fc00::/7 unique local, fe80::/10 link local, ff00::/8 multicast, 2001:db8::/32 docs
    if ((firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xffc0) === 0xfe80 || (firstGroup & 0xff00) === 0xff00) {
      return false;
    }

    if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) {
      return false;
    }

    // Only 2000::/3 is global unicast today.
    return (firstGroup & 0xe000) === 0x2000;
  }

  return false;
}

type EvaluateInput = {
  status: number;
  body: string;
  host: string;
  siteId: string;
};

function metaContent(html: string, name: string) {
  const tag = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

function canonicalHref(html: string) {
  const tag = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/href=["']([^"']*)["']/i)?.[1] ?? null;
}

/** Decides whether an HTML response is this site's blog served on the client host. */
export function evaluateBlogHtml({ body, host, siteId }: Omit<EvaluateInput, "status">): ProxyResult {
  const marker = metaContent(body, "diyseo-site");

  if (!marker) {
    return {
      ok: false,
      reason: "not_diyseo",
      message: `${host}/blog answers, but it is not a DIYSEO page. Another site or CMS may already own /blog, or the proxy is not attached yet.`
    };
  }

  if (marker !== siteId) {
    return {
      ok: false,
      reason: "wrong_site",
      message: "This domain serves a different DIYSEO site. Check the site ID in your proxy configuration."
    };
  }

  const canonical = canonicalHref(body);
  let canonicalHost = "";

  try {
    canonicalHost = canonical ? new URL(canonical).host.toLowerCase() : "";
  } catch {
    canonicalHost = "";
  }

  if (canonicalHost !== host.toLowerCase()) {
    return {
      ok: false,
      reason: "forwarded_host_missing",
      message:
        "The blog loads, but it still points to diyseo.online as its address. The proxy must send your domain in the X-Forwarded-Host header."
    };
  }

  return { ok: true, message: `${host}/blog is serving this site correctly.` };
}

export function evaluateProxyResponse({ status, body, host, siteId }: EvaluateInput & { location?: string | null }): ProxyResult {
  if (status === 404) {
    return {
      ok: false,
      reason: "not_found",
      message: `${host}/blog returned 404. The proxy rule is probably not attached to this path yet.`
    };
  }

  if (status >= 300 && status < 400) {
    return {
      ok: false,
      reason: "redirect",
      message: `${host}/blog redirects somewhere else. Serve the blog directly at /blog, without redirecting.`
    };
  }

  if (status !== 200) {
    return { ok: false, reason: "bad_status", message: `${host}/blog returned HTTP ${status}.` };
  }

  return evaluateBlogHtml({ body, host, siteId });
}

type FetchOnceResult = { status: number; location: string | null; body: string };

function fetchOnce(host: string, path: string, deadline: number): Promise<FetchOnceResult> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      reject(new Error("timeout"));
      return;
    }

    const request = https.request(
      {
        host,
        path,
        method: "GET",
        headers: { "user-agent": "DIYSEO-Verify/1.0", accept: "text/html" },
        // Validated at connect time, so a DNS answer that changes between a
        // pre-check and the connection cannot reach a private address.
        lookup: (hostname, options, callback) => {
          dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
            const list = Array.isArray(addresses) ? addresses : [];

            if (error || list.length === 0) {
              callback(error ?? new Error("no address"), "", 4);
              return;
            }

            if (!list.every((entry) => isPublicAddress(entry.address))) {
              callback(new Error("blocked address"), "", 4);
              return;
            }

            if (options.all) {
              (callback as unknown as (e: null, a: typeof list) => void)(null, list);
              return;
            }

            callback(null, list[0].address, list[0].family);
          });
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;

        response.on("data", (chunk: Buffer) => {
          size += chunk.length;

          if (size > MAX_BODY_BYTES) {
            request.destroy(new Error("too large"));
            return;
          }

          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            location: typeof response.headers.location === "string" ? response.headers.location : null,
            body: Buffer.concat(chunks).toString("utf8")
          })
        );
        response.on("error", reject);
      }
    );

    // One absolute deadline for DNS + connect + body, not an idle timeout.
    const timer = setTimeout(() => request.destroy(new Error("timeout")), remaining);

    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end();
  });
}

type VerifyDeps = { fetchOnce?: typeof fetchOnce };

export async function verifyProxy(host: string, siteId: string, deps: VerifyDeps = {}): Promise<ProxyResult> {
  if (!isVerifiableHost(host)) {
    return {
      ok: false,
      reason: "invalid_host",
      message: "The site domain must be a public domain name (for example client.com) to be verified."
    };
  }

  const get = deps.fetchOnce ?? fetchOnce;
  const deadline = Date.now() + DEADLINE_MS;

  try {
    let path = "/blog";
    let result = await get(host, path, deadline);

    // Allow one same-host https redirect (trailing slash or scheme normalization).
    if (result.status >= 300 && result.status < 400 && result.location) {
      try {
        const target = new URL(result.location, `https://${host}${path}`);

        if (target.protocol === "https:" && target.host.toLowerCase() === host.toLowerCase() && target.pathname.startsWith("/blog")) {
          path = `${target.pathname}${target.search}`;
          result = await get(host, path, deadline);
        }
      } catch {
        // fall through to the evaluation of the original response
      }
    }

    return evaluateProxyResponse({ status: result.status, location: result.location, body: result.body, host, siteId });
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      message: `Could not reach https://${host}/blog. Check that the domain resolves, has a valid HTTPS certificate and is public.`
    };
  }
}

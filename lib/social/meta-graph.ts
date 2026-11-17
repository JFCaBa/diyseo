import { withLink } from "@/lib/social/text";

/**
 * Minimal Meta Graph client for publishing to a Facebook Page and its Instagram account.
 * Every error is a MetaGraphError with the token redacted. `definite` says Meta surely did not publish:
 * only a 4xx with an error body on a publishing call is definite; a 5xx, network error or timeout there is not.
 */
export type GraphDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void>; version: string };

export function defaultGraphDeps(): GraphDeps {
  return {
    fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    version: process.env.META_GRAPH_VERSION?.trim() || "v26.0"
  };
}

export class MetaGraphError extends Error {
  constructor(message: string, readonly definite: boolean, readonly status: number) {
    super(message);
    this.name = "MetaGraphError";
  }
}

/** Per request. With MAX_POLLS this keeps a whole Instagram publish (~3.3 min worst case) well under the 5-minute UNKNOWN mark. */
export const GRAPH_TIMEOUT_MS = 15_000;
export const POLL_MS = 2000;
export const MAX_POLLS = 10;

/** Called right before the publishing request; false means the claim was lost, so nothing is posted. */
export type PublishOptions = { beforePublish?: () => Promise<boolean> };

async function ensureStillClaimed(opts: PublishOptions) {
  if (opts.beforePublish && !(await opts.beforePublish())) {
    throw new MetaGraphError("Publishing was cancelled because the post changed meanwhile", true, 0);
  }
}

export function redact(text: string, token: string): string {
  const withoutToken = token ? text.split(token).join("***") : text;
  return withoutToken.replace(/access_token=[^&\s"]+/g, "access_token=***");
}

type Params = Record<string, string>;

async function graph(
  method: "GET" | "POST",
  path: string,
  params: Params,
  token: string,
  deps: GraphDeps,
  opts: { publishing?: boolean } = {}
): Promise<Record<string, unknown>> {
  const base = `https://graph.facebook.com/${deps.version}/${path}`;
  const all = new URLSearchParams({ ...params, access_token: token });
  let res: Response;
  try {
    res =
      method === "GET"
        ? await deps.fetch(`${base}?${all.toString()}`, { method, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) })
        : await deps.fetch(base, { method, body: all, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new MetaGraphError(redact(`Could not reach Meta: ${msg}`, token), !opts.publishing, 0);
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!res.ok || body.error) {
    const err = body.error as { message?: unknown } | undefined;
    const message = typeof err?.message === "string" ? err.message : `Meta returned HTTP ${res.status}`;
    const definite = !opts.publishing || (res.status >= 400 && res.status < 500 && Boolean(err));
    throw new MetaGraphError(redact(message, token), definite, res.status);
  }
  return body;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export async function verifyPage(
  token: string,
  pageId: string,
  deps: GraphDeps
): Promise<{ pageName: string; pageToken: string; instagramAccountId: string | null; instagramUsername: string | null }> {
  const res = await graph("GET", pageId, { fields: "name,access_token,instagram_business_account{id,username}" }, token, deps);
  const ig = res.instagram_business_account as { id?: unknown; username?: unknown } | undefined;
  let pageToken = str(res.access_token);
  if (!pageToken) {
    // No Page token handed out: only a token that already *is* this Page's can post as it.
    const me = await graph("GET", "me", { fields: "id" }, token, deps);
    if (str(me.id) !== pageId) {
      throw new MetaGraphError(
        "This token cannot post as this Page. Use a system-user or user token with access to the Page, or the Page's own token.",
        true,
        400
      );
    }
    pageToken = token;
  }
  return {
    pageName: str(res.name) ?? pageId,
    pageToken,
    instagramAccountId: str(ig?.id),
    instagramUsername: str(ig?.username)
  };
}

export async function publishFacebook(
  token: string,
  pageId: string,
  post: { text: string; imageUrl: string | null; link: string },
  deps: GraphDeps,
  opts: PublishOptions = {}
): Promise<{ id: string; url: string }> {
  let id: string | null;
  await ensureStillClaimed(opts);
  if (post.imageUrl) {
    // /photos ignores `link`, so the link goes into the caption.
    const caption = withLink(post.text, post.link);
    const res = await graph("POST", `${pageId}/photos`, { url: post.imageUrl, caption }, token, deps, { publishing: true });
    id = str(res.post_id) ?? str(res.id);
  } else {
    const res = await graph("POST", `${pageId}/feed`, { message: post.text, link: post.link }, token, deps, { publishing: true });
    id = str(res.id);
  }
  if (!id) throw new MetaGraphError("Meta did not return a post id", false, 200);
  return { id, url: `https://www.facebook.com/${id}` };
}

export async function publishInstagram(
  token: string,
  igId: string,
  post: { text: string; imageUrl: string },
  deps: GraphDeps,
  opts: PublishOptions = {}
): Promise<{ id: string; url: string | null }> {
  const container = str((await graph("POST", `${igId}/media`, { image_url: post.imageUrl, caption: post.text }, token, deps)).id);
  if (!container) throw new MetaGraphError("Instagram did not return a container id", true, 200);

  let finished = false;
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    if (poll > 0) await deps.sleep(POLL_MS);
    const status = str((await graph("GET", container, { fields: "status_code" }, token, deps)).status_code);
    if (status === "FINISHED") {
      finished = true;
      break;
    }
    if (status === "ERROR" || status === "EXPIRED") throw new MetaGraphError("Instagram could not process the image", true, 200);
  }
  if (!finished) throw new MetaGraphError("Instagram is still processing the image, try again", true, 200);
  await ensureStillClaimed(opts);

  const mediaId = str((await graph("POST", `${igId}/media_publish`, { creation_id: container }, token, deps, { publishing: true })).id);
  if (!mediaId) throw new MetaGraphError("Instagram did not return a media id", false, 200);

  try {
    return { id: mediaId, url: str((await graph("GET", mediaId, { fields: "permalink" }, token, deps)).permalink) };
  } catch {
    return { id: mediaId, url: null };
  }
}

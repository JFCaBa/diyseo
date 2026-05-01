function joinOrigin(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}${path}`;
}

export function isLocalCoverImagePath(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

export function getCoverImageProxyPath(url: string) {
  if (isLocalCoverImagePath(url)) {
    return url;
  }

  return `/api/public/image?url=${encodeURIComponent(url)}`;
}

export function getCoverImageProxyUrl(url: string, origin?: string) {
  const path = getCoverImageProxyPath(url);
  return origin ? joinOrigin(origin, path) : path;
}

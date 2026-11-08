"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Sections of the site layout that are not the blog: they get the full height, without the blog header. */
const NON_BLOG = ["seo-data", "ads", "team", "billing"];

export function isBlogPath(pathname: string, siteId: string): boolean {
  const section = pathname.slice(`/${siteId}/`.length).split("/")[0];
  return !NON_BLOG.includes(section);
}

/** Renders its children (the blog header) only on blog pages. */
export function BlogOnly({ siteId, children }: { siteId: string; children: ReactNode }) {
  const pathname = usePathname();
  return isBlogPath(pathname, siteId) ? <>{children}</> : null;
}

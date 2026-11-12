import Link from "next/link";

import { getPublicBlogTheme } from "@/lib/public-blog-theme";
import { cn } from "@/lib/utils";

type PublicBlogHeaderProps = {
  siteName: string;
  /** Origin of the site's own domain, e.g. https://example.com */
  siteOrigin: string;
  blogPath: string;
  theme: ReturnType<typeof getPublicBlogTheme>;
  /** Width class of the page column below, so the header lines up with it. */
  className?: string;
};

/**
 * Slim top bar for a blog served under the client's own domain (reverse proxy),
 * where the client's real navigation is not available: brand back to the site,
 * and the blog.
 */
export function PublicBlogHeader({ siteName, siteOrigin, blogPath, theme, className }: PublicBlogHeaderProps) {
  return (
    <header className={cn("mx-auto mb-6 flex items-center justify-between gap-4 rounded-2xl border px-5 py-3 text-sm", theme.shell, className)}>
      <a href={`${siteOrigin}/`} className={cn("font-semibold tracking-tight", theme.navTitle)}>
        {siteName}
      </a>
      <nav className="flex items-center gap-5">
        <span className={theme.navText}>{new URL(siteOrigin).host}</span>
        <Link href={blogPath} className={cn("font-semibold transition", theme.navTitle)}>
          Blog
        </Link>
      </nav>
    </header>
  );
}

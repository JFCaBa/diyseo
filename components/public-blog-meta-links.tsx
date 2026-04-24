import Link from "next/link";

import { getPublicUrls } from "@/lib/public-urls";
import { cn } from "@/lib/utils";

type PublicBlogMetaLinksProps = {
  siteId?: string;
  theme?: "light" | "dark";
};

export async function PublicBlogMetaLinks({ siteId, theme = "light" }: PublicBlogMetaLinksProps) {
  const links = siteId
    ? await (async () => {
        const urls = await getPublicUrls(siteId);
        return [
          { href: urls.rssPath, label: "RSS" },
          { href: urls.atomPath, label: "Atom" },
          { href: urls.sitemapPath, label: "Sitemap" },
          { href: urls.robotsPath, label: "robots.txt" }
        ];
      })()
    : [{ href: "/blog/robots.txt", label: "robots.txt" }];

  return (
    <footer
      className={cn(
        "mt-10 border-t pt-5 text-xs",
        theme === "dark" ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {links.map((link, index) => (
          <div key={link.href} className="flex items-center gap-3">
            <Link
              href={link.href}
              className={cn(
                "underline-offset-4 transition hover:underline",
                theme === "dark" ? "hover:text-white" : "hover:text-slate-900"
              )}
            >
              {link.label}
            </Link>
            {index < links.length - 1 ? (
              <span className={theme === "dark" ? "text-slate-700" : "text-slate-300"}>•</span>
            ) : null}
          </div>
        ))}
      </div>
    </footer>
  );
}

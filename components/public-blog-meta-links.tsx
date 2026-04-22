import Link from "next/link";

import { getPublicUrls } from "@/lib/public-urls";

type PublicBlogMetaLinksProps = {
  siteId?: string;
};

export async function PublicBlogMetaLinks({ siteId }: PublicBlogMetaLinksProps) {
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
    <footer className="mt-10 border-t border-line pt-5 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {links.map((link, index) => (
          <div key={link.href} className="flex items-center gap-3">
            <Link href={link.href} className="underline-offset-4 transition hover:text-slate-900 hover:underline">
              {link.label}
            </Link>
            {index < links.length - 1 ? <span className="text-slate-300">•</span> : null}
          </div>
        ))}
      </div>
    </footer>
  );
}

import Link from "next/link";

type PublicBlogMetaLinksProps = {
  siteId?: string;
};

export function PublicBlogMetaLinks({ siteId }: PublicBlogMetaLinksProps) {
  const links = siteId
    ? [
        { href: `/blog/${siteId}/rss.xml`, label: "RSS" },
        { href: `/blog/${siteId}/atom.xml`, label: "Atom" },
        { href: `/blog/${siteId}/sitemap.xml`, label: "Sitemap" },
        { href: "/blog/robots.txt", label: "robots.txt" }
      ]
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

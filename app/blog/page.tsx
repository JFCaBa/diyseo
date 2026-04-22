import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const [sitesCount, workspace] = await Promise.all([
    prisma.siteProject.count(),
    prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true }
    })
  ]);

  const canonicalUrl = getAppUrl() ? `${getAppUrl()}/blog` : undefined;

  if (sitesCount === 0) {
    return {
      title: "Blogs - Currently Unavailable",
      description: "There are currently no public blogs available on this platform.",
      openGraph: {
        title: "Blogs - Currently Unavailable",
        description: "There are currently no public blogs available on this platform.",
        url: canonicalUrl,
        type: "website"
      },
      twitter: {
        card: "summary",
        title: "Blogs - Currently Unavailable",
        description: "There are currently no public blogs available on this platform."
      },
      alternates: canonicalUrl
        ? {
            canonical: canonicalUrl
          }
        : undefined
    };
  }

  return {
    title: `${workspace?.name || "Platform"} Blogs`,
    description: "Browse and discover the latest articles across all our hosted publications.",
    openGraph: {
      title: `${workspace?.name || "Platform"} Blogs`,
      description: "Browse and discover the latest articles across all our hosted publications.",
      url: canonicalUrl,
      type: "website"
    },
    twitter: {
      card: "summary",
      title: `${workspace?.name || "Platform"} Blogs`,
      description: "Browse and discover the latest articles across all our hosted publications."
    },
    alternates: canonicalUrl
      ? {
          canonical: canonicalUrl
        }
      : undefined
  };
}

export default async function PublicBlogHomePage() {
  const sites = await prisma.siteProject.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      domain: true
    }
  });

  if (sites.length === 1) {
    redirect(`/blog/${sites[0].id}`);
  }

  return (
    <main className="min-h-screen bg-sand/40 px-4 py-10 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-white px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10">
        <div className="space-y-4 border-b border-line pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Public Blogs</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Choose a blog</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Browse the published articles available across the sites hosted in this DIYSEO workspace.
          </p>
        </div>

        {sites.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-line bg-mist/70 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-slate-900">No public blogs available yet.</p>
            <p className="mt-2 text-sm text-slate-600">Create a site and publish articles to make a public blog available here.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-5">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/blog/${site.id}`}
                className="block rounded-3xl border border-line bg-white px-5 py-5 transition hover:border-slate-300 hover:bg-mist/40 sm:px-6 sm:py-6"
              >
                <div className="space-y-2">
                  <p className="text-2xl font-semibold tracking-tight text-slate-900">{site.name}</p>
                  <p className="text-sm leading-7 text-slate-600">{site.domain}</p>
                  <p className="text-sm font-semibold text-accent underline-offset-4 transition hover:text-teal-700 hover:underline">
                    Open blog
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <PublicBlogMetaLinks />
      </section>
    </main>
  );
}

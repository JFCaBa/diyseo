"use client";

import Link from "next/link";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type SiteSelectorProps = {
  currentSiteId: string;
  sites: Array<{ id: string; name: string }>;
};

export function SiteSelector({ currentSiteId, sites }: SiteSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
        <span className="text-slate-500">Site</span>
        <select
          className="min-w-44 bg-transparent font-medium text-ink outline-none"
          defaultValue={currentSiteId}
          disabled={isPending}
          onChange={(event) => {
            const nextSiteId = event.target.value;
            const nextPath = pathname.replace(`/${currentSiteId}`, `/${nextSiteId}`);

            startTransition(() => {
              router.push(nextPath);
            });
          }}
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <Link
        href="/new-site"
        className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-mist"
      >
        Add Site
      </Link>
    </div>
  );
}

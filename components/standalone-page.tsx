import Link from "next/link";
import { type ReactNode } from "react";

import { getT } from "@/lib/i18n/server";

/** Wrapper for workspace pages when the workspace has no site yet, so there is no site sidebar to show them in. */
export async function StandalonePage({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/new-site" className="text-sm font-semibold text-accent hover:underline">
        {t("shell.createFirstSite")}
      </Link>
      <div className="mt-6">{children}</div>
    </main>
  );
}

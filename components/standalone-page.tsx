import Link from "next/link";
import { type ReactNode } from "react";

/** Wrapper for workspace pages when the workspace has no site yet, so there is no site sidebar to show them in. */
export function StandalonePage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/new-site" className="text-sm font-semibold text-accent hover:underline">
        Create your first site
      </Link>
      <div className="mt-6">{children}</div>
    </main>
  );
}

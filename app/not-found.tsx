import Link from "next/link";

import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
      <div className="w-full rounded-3xl border border-line bg-white/90 p-10 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("shell.notFoundEyebrow")}</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{t("shell.notFoundTitle")}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {t("shell.notFoundBody")}
        </p>
        <Link
          href="/settings"
          className="mt-6 inline-flex rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t("shell.notFoundAction")}
        </Link>
      </div>
    </main>
  );
}

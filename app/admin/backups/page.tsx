import Link from "next/link";

import { requireAdminAuth } from "@/lib/admin-auth";

export default async function AdminBackupsPage() {
  await requireAdminAuth();

  const backupCommand = `pg_dump "$DATABASE_URL" | gzip > diyseo-full-backup-$(date +%Y%m%d-%H%M%S).sql.gz`;

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Backups</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Download a PostgreSQL backup you can store locally. Restore and destructive actions are intentionally not available in this panel.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Full database backup download</h2>
            <p className="mt-2 text-sm text-slate-400">Download a PostgreSQL backup you can store locally.</p>
            <p className="mt-2 text-sm text-amber-300">
              This backup includes users, sites, articles, keywords, Brand DNA, settings, and integration metadata.
            </p>
            <p className="mt-2 text-sm text-amber-200">Store it securely.</p>
          </div>
          <Link
            href="/admin/backups/download"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Download full database backup
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Recommended backup command</h2>
        <p className="mt-2 text-sm text-slate-400">
          Run this from a secure shell with `DATABASE_URL` set to your production database connection string. The in-app
          download route also requires `pg_dump` to be installed on the server.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
          <code>{backupCommand}</code>
        </pre>
        <div className="mt-4 grid gap-3 text-sm text-slate-400">
          <p>Use encrypted storage for backup files and restrict access to operators only.</p>
          <p>Verify backups periodically by restoring them in a separate environment.</p>
          <p>No in-app restore flow is provided in v1.</p>
        </div>
      </div>
    </section>
  );
}

import { requireAdminAuth } from "@/lib/admin-auth";

export default async function AdminBackupsPage() {
  await requireAdminAuth();

  const backupCommand = `pg_dump "$DATABASE_URL" > diyseo-backup-$(date +%Y%m%d-%H%M%S).sql`;

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Backups</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Read-only backup guidance for PostgreSQL. Restore and destructive actions are intentionally not available in this panel.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Recommended backup command</h2>
        <p className="mt-2 text-sm text-slate-400">
          Run this from a secure shell with `DATABASE_URL` set to your production database connection string.
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

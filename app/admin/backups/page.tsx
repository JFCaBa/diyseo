import Link from "next/link";

import { requireAdminAuth } from "@/lib/admin-auth";
import { listStoredBackups } from "@/lib/backup-utils";

type AdminBackupsPageProps = {
  searchParams?: Promise<{
    restore?: string;
    message?: string;
    backup?: string;
  }>;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default async function AdminBackupsPage({ searchParams }: AdminBackupsPageProps) {
  await requireAdminAuth();

  const restoreState = searchParams ? await searchParams : undefined;
  const storedBackups = await listStoredBackups();
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

      {restoreState?.restore === "success" ? (
        <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 px-4 py-4 text-sm text-teal-100">
          Restore completed successfully. A pre-restore backup was created as {restoreState.backup || "a saved backup"}.
        </div>
      ) : null}

      {restoreState?.restore === "error" ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          {restoreState.message || "Database restore failed."}
        </div>
      ) : null}

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Stored daily backups</h2>
            <p className="mt-2 text-sm text-slate-400">
              Automatic server backups saved in `backups/`. Only the latest 7 are kept.
            </p>
          </div>
        </div>

        {storedBackups.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            No stored backups found yet. Run `npm run backup:database` from the server to create the first one.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1.4fr)_180px_120px_120px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <p>Filename</p>
              <p>Date</p>
              <p>Size</p>
              <p className="text-right">Download</p>
            </div>
            <div className="divide-y divide-slate-800">
              {storedBackups.map((backup) => (
                <div
                  key={backup.filename}
                  className="grid grid-cols-[minmax(0,1.4fr)_180px_120px_120px] gap-3 px-4 py-4 text-sm text-slate-300"
                >
                  <p className="truncate font-medium text-white">{backup.filename}</p>
                  <p>{formatDateTime(backup.createdAt)}</p>
                  <p>{formatFileSize(backup.size)}</p>
                  <div className="text-right">
                    <Link
                      href={`/admin/backups/files/${encodeURIComponent(backup.filename)}`}
                      className="font-semibold text-teal-400 hover:underline"
                    >
                      Download
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-rose-900/60 bg-slate-900/80 p-6 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold text-white">Restore from SQL backup</h2>
          <p className="mt-2 text-sm text-slate-400">
            Upload a `.sql` backup file to restore the current database. This is destructive and will overwrite the current database state.
          </p>
          <p className="mt-2 text-sm text-amber-300">
            A pre-restore backup is created automatically before the restore starts.
          </p>
        </div>

        <form action="/admin/backups/restore" method="post" encType="multipart/form-data" className="mt-6 grid gap-4 md:max-w-2xl">
          <div className="grid gap-2">
            <label htmlFor="backupFile" className="text-sm font-medium text-slate-200">
              SQL backup file
            </label>
            <input
              id="backupFile"
              name="backupFile"
              type="file"
              accept=".sql"
              required
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="confirmRestore" className="text-sm font-medium text-slate-200">
              Type RESTORE to confirm
            </label>
            <input
              id="confirmRestore"
              name="confirmRestore"
              type="text"
              autoComplete="off"
              required
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-rose-400"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Restore database
            </button>
          </div>
        </form>
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

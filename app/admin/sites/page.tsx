import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}

function formatDomain(value: string) {
  try {
    return new URL(value).host.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export default async function AdminSitesPage() {
  await requireAdminAuth();

  const sites = await prisma.siteProject.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      name: true,
      domain: true,
      createdAt: true,
      workspace: {
        select: {
          owner: {
            select: {
              email: true
            }
          }
        }
      },
      _count: {
        select: {
          articles: true,
          keywords: true
        }
      }
    }
  });

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Sites</h1>
        <p className="mt-1 text-sm text-slate-400">Site inventory, owners, and content totals.</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_100px_100px_120px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <p>Site</p>
          <p>Domain</p>
          <p>Owner</p>
          <p>Articles</p>
          <p>Keywords</p>
          <p>Created</p>
        </div>
        <div className="divide-y divide-slate-800">
          {sites.map((site) => (
            <div
              key={site.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_100px_100px_120px] gap-3 px-4 py-4 text-sm text-slate-300"
            >
              <p className="truncate font-medium text-white">{site.name}</p>
              <p className="truncate" title={site.domain}>
                {formatDomain(site.domain)}
              </p>
              <p className="truncate">{site.workspace.owner.email || "No owner email"}</p>
              <p>{site._count.articles}</p>
              <p>{site._count.keywords}</p>
              <p>{formatDate(site.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

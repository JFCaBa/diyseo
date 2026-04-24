import { AdminArticleStatusToggle } from "@/components/admin-article-status-toggle";
import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export default async function AdminContentPage() {
  await requireAdminAuth();

  const articles = await prisma.article.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      publishedAt: true,
      siteProject: {
        select: {
          name: true
        }
      }
    }
  });

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Content</h1>
        <p className="mt-1 text-sm text-slate-400">Recent article activity across all sites.</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_150px_150px_110px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <p>Title</p>
          <p>Site</p>
          <p>Status</p>
          <p>Created</p>
          <p>Published</p>
          <p>Actions</p>
        </div>
        <div className="divide-y divide-slate-800">
          {articles.map((article) => (
            <div
              key={article.id}
              className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_150px_150px_110px] items-center gap-3 px-4 py-4 text-sm text-slate-300"
            >
              <p className="truncate font-medium text-white">{article.title}</p>
              <p className="truncate">{article.siteProject.name}</p>
              <p className={article.status === "PUBLISHED" ? "text-teal-400" : "text-slate-500"}>
                {article.status === "PUBLISHED" ? "Published" : "Draft"}
              </p>
              <p>{formatDateTime(article.createdAt)}</p>
              <p>{formatDateTime(article.publishedAt)}</p>
              <AdminArticleStatusToggle articleId={article.id} status={article.status} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

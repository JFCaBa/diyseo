export default function AnalyticsLoading() {
  return (
    <section className="space-y-8">
      <div className="space-y-2 border-b border-line pb-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="h-10 w-52 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-slate-200" />
      </div>

      <div className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Loading</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Fetching analytics</h2>
        <p className="mt-2 text-sm text-slate-600">
          Internal metrics and any available Google Search Console data are loading now.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
            <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-9 w-16 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-4 w-36 animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}

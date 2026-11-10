import { requireAdmin } from "@/lib/admin-auth";
import { bucketByWeekUtc, countByEffectivePlan, fillMonthlyUsage, usageWindowStartUtc } from "@/lib/admin-metrics";
import { prisma } from "@/lib/prisma";

const WEEKS = 12;
const MONTHS = 6;

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function barWidth(value: number, max: number) {
  if (max <= 0 || value <= 0) return "0%";
  // A nonzero value always shows a sliver, so 1 against 300 stays visible.
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

function Block({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{caption}</p>
      <div className="mt-6 space-y-3">{children}</div>
    </section>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-slate-400">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-teal-400" style={{ width: barWidth(value, max) }} />
      </div>
      <span className="w-12 shrink-0 text-right text-white">{formatCount(value)}</span>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const now = new Date();
  const weeksFirst = bucketByWeekUtc([], now, WEEKS)[0].weekStart;
  const usageFrom = usageWindowStartUtc(now, MONTHS);

  const [owners, workspaces, usageRows] = await Promise.all([
    prisma.user.findMany({
      where: { workspace: { isNot: null }, createdAt: { gte: weeksFirst } },
      select: { createdAt: true }
    }),
    prisma.workspace.findMany({ select: { plan: true, trialEndsAt: true } }),
    prisma.$queryRaw<{ month: Date; kind: string; count: number }[]>`
      SELECT date_trunc('month', "createdAt" AT TIME ZONE 'UTC', 'UTC') AS month,
             "kind" AS kind,
             count(*)::int AS count
      FROM "AiUsage"
      WHERE "status" = 'COMMITTED' AND "createdAt" >= ${usageFrom}
      GROUP BY 1, 2
      ORDER BY 1, 2`
  ]);

  const signups = bucketByWeekUtc(owners.map((u) => u.createdAt), now, WEEKS);
  const signupMax = Math.max(0, ...signups.map((b) => b.count));

  const plans = countByEffectivePlan(workspaces, now);
  const planEntries = Object.entries(plans);
  const planMax = Math.max(0, ...planEntries.map(([, n]) => n));

  const usage = fillMonthlyUsage(
    usageRows.map((r) => ({ month: new Date(r.month), kind: r.kind, count: Number(r.count) })),
    now,
    MONTHS
  );
  const usageMax = Math.max(0, ...usage.map((m) => m.total));

  return (
    <section className="space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Platform</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">All weeks and months are UTC.</p>
      </div>

      <Block
        title="Signups per week"
        caption={`Account owners created in each of the last ${WEEKS} UTC weeks (weeks start on Monday).`}
      >
        {signups.map((b) => (
          <BarRow key={b.weekStart.toISOString()} label={b.weekStart.toISOString().slice(0, 10)} value={b.count} max={signupMax} />
        ))}
      </Block>

      <Block title="Users by plan" caption="Workspaces counted by their effective plan right now (an expired trial counts as NONE).">
        {planEntries.map(([plan, n]) => (
          <BarRow key={plan} label={plan} value={n} max={planMax} />
        ))}
      </Block>

      <Block
        title="AI usage per month"
        caption={`Committed AI generations in each of the last ${MONTHS} UTC months, split by kind.`}
      >
        {usage.map((m) => (
          <div key={m.month.toISOString()} className="space-y-1">
            <BarRow label={m.month.toISOString().slice(0, 7)} value={m.total} max={usageMax} />
            {Object.keys(m.counts).length > 0 ? (
              <p className="text-xs text-slate-500" style={{ paddingLeft: "6.75rem" }}>
                {Object.entries(m.counts)
                  .map(([kind, n]) => `${kind}: ${formatCount(n)}`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
      </Block>
    </section>
  );
}

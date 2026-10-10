import { BarChart3, Bot, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addDays, todayString } from "@/lib/time";
import { formatMoney } from "@/lib/utils";
import { Card, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? "var(--color-brand)" }} />
    </div>
  );
}

export default async function ReportsPage() {
  const today = todayString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000);

  const [
    totalRevenue90,
    revenueByTreatment,
    bookingsBySource,
    callOutcomes,
    noShowRate,
    doctorUtilization,
    patientStatusCounts,
    monthlyRevenue,
  ] = await Promise.all([
    // Total revenue last 90 days
    prisma.treatmentRecord.aggregate({
      _sum: { cost: true },
      where: { status: "COMPLETED", performedAt: { gte: ninetyDaysAgo } },
    }),

    // Revenue by treatment type (last 90 days)
    prisma.treatmentRecord.groupBy({
      by: ["treatmentTypeId"],
      _sum: { cost: true },
      _count: true,
      where: { status: "COMPLETED", performedAt: { gte: ninetyDaysAgo } },
      orderBy: { _sum: { cost: "desc" } },
    }),

    // Bookings by source (last 30 days)
    prisma.appointment.groupBy({
      by: ["source"],
      _count: true,
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: "HELD" } },
    }),

    // Call outcomes (last 30 days)
    prisma.callLog.groupBy({
      by: ["outcome"],
      _count: true,
      where: { startedAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { outcome: "desc" } },
    }),

    // No-show rate (last 90 days)
    prisma.appointment.groupBy({
      by: ["status"],
      _count: true,
      where: {
        start: { gte: ninetyDaysAgo },
        status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED"] },
      },
    }),

    // Doctor utilization (completed appointments last 30 days)
    prisma.appointment.groupBy({
      by: ["doctorId"],
      _count: true,
      where: { status: "COMPLETED", start: { gte: thirtyDaysAgo } },
      orderBy: { _count: { doctorId: "desc" } },
    }),

    // Patient pipeline
    prisma.patient.groupBy({
      by: ["status"],
      _count: true,
    }),

    // Monthly revenue (last 6 months) — group by month
    prisma.treatmentRecord.findMany({
      where: { status: "COMPLETED", performedAt: { gte: sixMonthsAgo } },
      select: { performedAt: true, cost: true },
    }),
  ]);

  // Enrich treatment data with names
  const treatmentTypes = await prisma.treatmentType.findMany();
  const ttMap = Object.fromEntries(treatmentTypes.map((t) => [t.id, t]));

  // Enrich doctor data
  const doctors = await prisma.doctor.findMany();
  const drMap = Object.fromEntries(doctors.map((d) => [d.id, d]));

  // Build monthly revenue buckets
  const monthBuckets: Record<string, number> = {};
  for (const r of monthlyRevenue) {
    const key = r.performedAt.toISOString().slice(0, 7); // YYYY-MM
    monthBuckets[key] = (monthBuckets[key] ?? 0) + r.cost;
  }
  const sortedMonths = Object.entries(monthBuckets).sort(([a], [b]) => a.localeCompare(b));
  const maxMonthlyRevenue = Math.max(...sortedMonths.map(([, v]) => v), 1);

  const totalAppts = noShowRate.reduce((s, g) => s + g._count, 0);
  const noShows = noShowRate.find((g) => g.status === "NO_SHOW")?._count ?? 0;
  const noShowPct = totalAppts > 0 ? Math.round((noShows / totalAppts) * 100) : 0;

  const totalBookings30 = bookingsBySource.reduce((s, g) => s + g._count, 0);
  const aiBooked = bookingsBySource.find((g) => g.source === "VOICE_AI")?._count ?? 0;
  const aiPct = totalBookings30 > 0 ? Math.round((aiBooked / totalBookings30) * 100) : 0;

  const maxDrAppts = Math.max(...doctorUtilization.map((g) => g._count), 1);
  const maxTrRevenue = Math.max(...revenueByTreatment.map((g) => g._sum.cost ?? 0), 1);

  const patientTotal = patientStatusCounts.reduce((s, g) => s + g._count, 0);

  return (
    <>
      <PageHeader title="Reports & analytics" subtitle="Last 30–90 days performance" icon={BarChart3} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Revenue (90 days)" value={formatMoney(totalRevenue90._sum.cost ?? 0)} icon={TrendingUp} tone="emerald" />
        <StatCard label="AI booking rate (30d)" value={`${aiPct}%`} hint={`${aiBooked} of ${totalBookings30} bookings`} icon={Bot} tone="indigo" />
        <StatCard label="No-show rate (90d)" value={`${noShowPct}%`} hint={`${noShows} no-shows of ${totalAppts}`} icon={Users} tone="rose" />
        <StatCard label="Active patients" value={patientStatusCounts.find((g) => g.status === "ACTIVE")?._count ?? 0} hint={`${patientTotal} total`} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue */}
        <Card title="Monthly revenue (6 months)">
          <div className="space-y-3 p-5">
            {sortedMonths.length === 0 ? (
              <p className="text-sm text-muted">No completed treatments yet.</p>
            ) : (
              sortedMonths.map(([month, rev]) => (
                <div key={month}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{new Date(`${month}-01`).toLocaleString("en", { month: "short", year: "numeric" })}</span>
                    <span className="font-semibold">{formatMoney(rev)}</span>
                  </div>
                  <Bar value={rev} max={maxMonthlyRevenue} color="#14b8a6" />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Revenue by treatment */}
        <Card title="Revenue by treatment (90 days)">
          <div className="space-y-3 p-5">
            {revenueByTreatment.length === 0 ? (
              <p className="text-sm text-muted">No data yet.</p>
            ) : (
              revenueByTreatment.slice(0, 8).map((g) => {
                const tt = ttMap[g.treatmentTypeId];
                return (
                  <div key={g.treatmentTypeId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tt?.color ?? "#6366f1" }} />
                        {tt?.name ?? "Unknown"}
                      </span>
                      <span className="font-semibold">{formatMoney(g._sum.cost ?? 0)}</span>
                    </div>
                    <Bar value={g._sum.cost ?? 0} max={maxTrRevenue} color={tt?.color} />
                    <div className="mt-0.5 text-xs text-muted">{g._count} treatments</div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Doctor utilization */}
        <Card title="Doctor utilization (30 days)">
          <div className="space-y-3 p-5">
            {doctorUtilization.length === 0 ? (
              <p className="text-sm text-muted">No completed appointments yet.</p>
            ) : (
              doctorUtilization.map((g) => {
                const dr = drMap[g.doctorId];
                return (
                  <div key={g.doctorId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dr?.color ?? "#6366f1" }} />
                        {dr?.name ?? "Unknown"}
                      </span>
                      <span className="font-semibold">{g._count} appts</span>
                    </div>
                    <Bar value={g._count} max={maxDrAppts} color={dr?.color} />
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Call outcomes and booking sources */}
        <div className="space-y-6">
          <Card title="AI call outcomes (30 days)">
            <div className="space-y-2 p-5">
              {callOutcomes.length === 0 ? (
                <p className="text-sm text-muted">No calls logged yet.</p>
              ) : (
                callOutcomes.map((g) => {
                  const total = callOutcomes.reduce((s, x) => s + x._count, 0);
                  const pct = total > 0 ? Math.round((g._count / total) * 100) : 0;
                  return (
                    <div key={g.outcome} className="flex items-center gap-3 text-sm">
                      <span className="w-28 truncate text-muted capitalize">{g.outcome.toLowerCase()}</span>
                      <div className="flex-1">
                        <Bar value={g._count} max={total} />
                      </div>
                      <span className="w-12 text-right font-semibold">{g._count} <span className="text-xs font-normal text-muted">({pct}%)</span></span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card title="Patient pipeline">
            <div className="space-y-2 p-5">
              {patientStatusCounts.map((g) => {
                const pct = patientTotal > 0 ? Math.round((g._count / patientTotal) * 100) : 0;
                const COLOR: Record<string, string> = { ACTIVE: "#14b8a6", NEW: "#6366f1", LEAD: "#f59e0b", NEEDS_FOLLOW_UP: "#f43f5e", INACTIVE: "#94a3b8" };
                return (
                  <div key={g.status} className="flex items-center gap-3 text-sm">
                    <span className="w-32 truncate text-muted capitalize">{g.status.toLowerCase().replace("_", " ")}</span>
                    <div className="flex-1"><Bar value={g._count} max={patientTotal} color={COLOR[g.status]} /></div>
                    <span className="w-12 text-right font-semibold">{g._count} <span className="text-xs font-normal text-muted">({pct}%)</span></span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

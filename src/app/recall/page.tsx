import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/ui";
import { sendRecallSms } from "../actions";

export const dynamic = "force-dynamic";

const GROUPS = [
  { label: "3–6 months overdue", minDays: 90, maxDays: 180 },
  { label: "6–12 months overdue", minDays: 180, maxDays: 365 },
  { label: "12+ months overdue", minDays: 365, maxDays: Infinity },
];

export default async function RecallPage({ searchParams }: { searchParams: { months?: string } }) {
  const filterMonths = Number(searchParams.months ?? 0) || null;
  const now = new Date();

  // Patients with a completed appointment whose last completed appointment is >3 months ago
  // and who have no upcoming appointments.
  const cutoff90 = new Date(now.getTime() - 90 * 86400000);

  const lastCompletedRaw = await prisma.appointment.groupBy({
    by: ["patientId"],
    _max: { start: true },
    where: { status: "COMPLETED", start: { lt: cutoff90 } },
  });

  const patientIds = lastCompletedRaw.map((x) => x.patientId);
  if (patientIds.length === 0) {
    return (
      <>
        <PageHeader title="Recall queue" subtitle="Patients due for a check-up" />
        <Empty>No overdue patients found.</Empty>
      </>
    );
  }

  const withUpcoming = await prisma.appointment.findMany({
    where: { patientId: { in: patientIds }, start: { gt: now }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    select: { patientId: true },
    distinct: ["patientId"],
  });
  const upcomingSet = new Set(withUpcoming.map((a) => a.patientId));

  const overdueMap = new Map(
    lastCompletedRaw
      .filter((x) => !upcomingSet.has(x.patientId))
      .map((x) => [x.patientId, x._max.start!]),
  );

  const patients = await prisma.patient.findMany({
    where: { id: { in: [...overdueMap.keys()] }, optOut: false },
    include: {
      appointments: {
        where: { status: "COMPLETED" },
        orderBy: { start: "desc" },
        take: 1,
        include: { doctor: { select: { name: true } }, treatmentType: { select: { name: true } } },
      },
    },
  });

  const withDays = patients
    .map((p) => {
      const last = overdueMap.get(p.id);
      if (!last) return null;
      const days = Math.floor((now.getTime() - last.getTime()) / 86400000);
      return { patient: p, lastSeen: last, days };
    })
    .filter(Boolean) as { patient: typeof patients[0]; lastSeen: Date; days: number }[];

  withDays.sort((a, b) => b.days - a.days);

  const groups = GROUPS.map((g) => ({
    ...g,
    items: withDays.filter((x) => x.days >= g.minDays && x.days < g.maxDays),
  })).filter((g) => {
    if (filterMonths) {
      const minDays = filterMonths * 30;
      return g.minDays >= minDays;
    }
    return g.items.length > 0;
  });

  const total = withDays.length;

  return (
    <>
      <PageHeader
        title="Recall queue"
        subtitle={`${total} patient${total !== 1 ? "s" : ""} overdue for a check-up`}
        actions={
          <div className="flex gap-2">
            {[null, 3, 6, 12].map((m) => (
              <Link
                key={m ?? "all"}
                href={m ? `/recall?months=${m}` : "/recall"}
                className={`btn-ghost btn-sm ${(!filterMonths && !m) || filterMonths === m ? "bg-brand-soft text-brand" : ""}`}
              >
                {m ? `${m}m+` : "All"}
              </Link>
            ))}
          </div>
        }
      />

      {total === 0 && <Empty>No overdue patients — great work!</Empty>}

      <div className="space-y-6">
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.label}>
              <h2 className="mb-3 text-sm font-semibold text-muted uppercase tracking-wide">{group.label}</h2>
              <div className="card divide-y divide-border">
                {group.items.map(({ patient: p, lastSeen, days }) => {
                  const lastAppt = p.appointments[0];
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/patients/${p.id}`} className="font-medium hover:underline">
                          {fullName(p)}
                        </Link>
                        <p className="text-sm text-muted">
                          Last seen {fmtDate(lastSeen)} ({days} days ago)
                          {lastAppt ? ` · ${lastAppt.treatmentType.name} with ${lastAppt.doctor.name}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link
                          href={`/appointments/new?patientId=${p.id}`}
                          className="btn-ghost btn-sm"
                        >
                          Book
                        </Link>
                        <form action={sendRecallSms}>
                          <input type="hidden" name="patientId" value={p.id} />
                          <button className="btn-ghost btn-sm">SMS</button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </>
  );
}

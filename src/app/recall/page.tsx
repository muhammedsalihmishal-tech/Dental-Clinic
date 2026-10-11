import Link from "next/link";
import { Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/ui";
import { sendRecallSms, sendAllRecalls } from "../actions";

export const dynamic = "force-dynamic";

export default async function RecallPage() {
  const now = new Date();

  // Only treatment types that have a recall schedule configured
  const treatmentTypes = await prisma.treatmentType.findMany({
    where: { recallMonths: { not: null } },
    orderBy: { name: "asc" },
  });

  if (treatmentTypes.length === 0) {
    return (
      <>
        <PageHeader
          title="Recall queue"
          subtitle="Patients due for a follow-up by treatment type"
        />
        <Empty>
          No recall schedules configured. Set a &quot;Recall interval&quot; on one or more treatment types in{" "}
          <Link href="/settings/treatments" className="text-brand hover:underline">Treatment settings</Link>.
        </Empty>
      </>
    );
  }

  type RecallGroup = {
    treatmentType: (typeof treatmentTypes)[0];
    items: { patientId: string; firstName: string; lastName: string; phone: string; lastSeen: Date; daysSince: number; lastRecallSentAt: Date | null }[];
  };

  const groups: RecallGroup[] = [];

  for (const tt of treatmentTypes) {
    const recallMonths = tt.recallMonths!;
    const cutoff = new Date(now.getTime() - recallMonths * 30 * 86400000);
    const recallDedupeWindow = new Date(now.getTime() - 30 * 86400000);

    // Patients whose last COMPLETED appointment for this treatment type was before cutoff
    const lastAppts = await prisma.appointment.groupBy({
      by: ["patientId"],
      _max: { start: true },
      where: { treatmentTypeId: tt.id, status: "COMPLETED", start: { lt: cutoff } },
    });
    if (lastAppts.length === 0) continue;

    const candidateIds = lastAppts.map((x) => x.patientId);
    const lastApptMap = new Map(lastAppts.map((x) => [x.patientId, x._max.start!]));

    // Exclude patients with upcoming appointments of this type
    const hasUpcoming = await prisma.appointment.findMany({
      where: {
        patientId: { in: candidateIds },
        treatmentTypeId: tt.id,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        start: { gt: now },
      },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    const upcomingSet = new Set(hasUpcoming.map((a) => a.patientId));

    const dueIds = candidateIds.filter((id) => !upcomingSet.has(id));
    if (dueIds.length === 0) continue;

    const patients = await prisma.patient.findMany({
      where: { id: { in: dueIds }, optOut: false },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });

    // Fetch most recent recall log per patient for this treatment type
    const recentLogs = await prisma.recallLog.findMany({
      where: { patientId: { in: dueIds }, treatmentTypeId: tt.id },
      orderBy: { sentAt: "desc" },
      distinct: ["patientId"],
    });
    const logMap = new Map(recentLogs.map((l) => [l.patientId, l.sentAt]));

    const items = patients
      .map((p) => {
        const lastSeen = lastApptMap.get(p.id);
        if (!lastSeen) return null;
        const lastRecallSentAt = logMap.get(p.id) ?? null;
        const alreadySentRecently = lastRecallSentAt && lastRecallSentAt > recallDedupeWindow;
        if (alreadySentRecently) return null;
        return {
          patientId: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
          lastSeen,
          daysSince: Math.floor((now.getTime() - lastSeen.getTime()) / 86400000),
          lastRecallSentAt,
        };
      })
      .filter(Boolean) as RecallGroup["items"];

    if (items.length === 0) continue;
    items.sort((a, b) => b.daysSince - a.daysSince);
    groups.push({ treatmentType: tt, items });
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <PageHeader
        title="Recall queue"
        subtitle={`${total} patient${total !== 1 ? "s" : ""} due for a follow-up`}
        actions={
          <Link href="/settings/treatments" className="btn-ghost btn-sm">
            Configure schedules
          </Link>
        }
      />

      {total === 0 && <Empty>No patients are recall-due right now — great work!</Empty>}

      <div className="space-y-8">
        {groups.map(({ treatmentType: tt, items }) => (
          <div key={tt.id}>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: tt.color }} />
              <h2 className="text-sm font-semibold">
                {tt.name}
                <span className="ml-2 font-normal text-muted">· recall every {tt.recallMonths} months · {items.length} due</span>
              </h2>
              <form action={sendAllRecalls} className="ml-auto">
                <input type="hidden" name="treatmentTypeId" value={tt.id} />
                {items.map((item) => (
                  <input key={item.patientId} type="hidden" name="patientId" value={item.patientId} />
                ))}
                <button className="btn-primary btn-sm gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send all ({items.length})
                </button>
              </form>
            </div>

            <div className="card divide-y divide-border">
              {items.map((item) => (
                <div key={item.patientId} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/patients/${item.patientId}`} className="font-medium hover:underline">
                      {fullName(item)}
                    </Link>
                    <p className="text-sm text-muted">
                      Last {tt.name.toLowerCase()} {fmtDate(item.lastSeen)} · {item.daysSince} days ago
                      {item.lastRecallSentAt && (
                        <span className="ml-2 text-xs">· recalled {fmtDate(item.lastRecallSentAt)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/appointments/new?patientId=${item.patientId}`} className="btn-ghost btn-sm">
                      Book
                    </Link>
                    <form action={sendRecallSms}>
                      <input type="hidden" name="patientId" value={item.patientId} />
                      <input type="hidden" name="treatmentTypeId" value={tt.id} />
                      <button className="btn-ghost btn-sm">SMS</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

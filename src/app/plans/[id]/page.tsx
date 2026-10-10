import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { updateTreatmentPlan, assignRecordToPlan } from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ABANDONED: "bg-muted/30 text-muted",
};

const REC_STATUS_COLOR: Record<string, string> = {
  PLANNED: "bg-muted/20 text-muted",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default async function PlanDetailPage({ params }: { params: { id: string } }) {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      records: {
        include: { treatmentType: { select: { name: true } }, doctor: { select: { name: true } } },
        orderBy: { performedAt: "asc" },
      },
    },
  });
  if (!plan) notFound();

  const unlinkedRecords = await prisma.treatmentRecord.findMany({
    where: { patientId: plan.patientId, planId: null },
    include: { treatmentType: { select: { name: true } } },
    orderBy: { performedAt: "desc" },
    take: 50,
  });

  const total = plan.records.reduce((s, r) => s + r.cost, 0);
  const done = plan.records.filter((r) => r.status === "COMPLETED").length;
  const pct = plan.records.length ? Math.round((done / plan.records.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title={plan.title}
        subtitle={
          <span>
            <Link href={`/patients/${plan.patient.id}`} className="hover:underline">{fullName(plan.patient)}</Link>
            {" · "}{plan.records.length} steps · {formatMoney(total)}
          </span>
        }
        actions={
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[plan.status]}`}>
            {plan.status}
          </span>
        }
      />

      {plan.records.length > 0 && (
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>{done} of {plan.records.length} steps complete</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {plan.records.length === 0 && <Empty>No treatment steps yet. Add records below.</Empty>}
          {plan.records.map((r) => (
            <div key={r.id} className="card fade-in flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.treatmentType.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REC_STATUS_COLOR[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {r.doctor.name} · {fmtDate(r.performedAt)}
                  {r.teeth ? ` · ${r.teeth}` : ""}
                </p>
                {r.notes && <p className="text-xs text-muted mt-0.5">{r.notes}</p>}
              </div>
              <div className="text-right shrink-0 text-sm font-medium">{formatMoney(r.cost)}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Card title="Edit plan">
            <form action={updateTreatmentPlan} className="space-y-3 p-5">
              <input type="hidden" name="id" value={plan.id} />
              <Field label="Title">
                <input name="title" defaultValue={plan.title} className="input" />
              </Field>
              <Field label="Notes">
                <textarea name="notes" defaultValue={plan.notes ?? ""} className="input min-h-[60px]" />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={plan.status} className="input">
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ABANDONED">Abandoned</option>
                </select>
              </Field>
              <button className="btn-primary w-full">Save changes</button>
            </form>
          </Card>

          {unlinkedRecords.length > 0 && (
            <Card title="Add existing record">
              <form action={assignRecordToPlan} className="space-y-3 p-5">
                <input type="hidden" name="planId" value={plan.id} />
                <Field label="Treatment record">
                  <select name="recordId" required className="input">
                    <option value="">Select…</option>
                    {unlinkedRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.treatmentType.name} · {fmtDate(r.performedAt)} · {r.status}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="btn-primary w-full">Add to plan</button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { createTreatmentPlan } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ABANDONED: "bg-muted/30 text-muted line-through",
};

export default async function PlansPage({ searchParams }: { searchParams: { patient?: string } }) {
  const [plans, patients] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: searchParams.patient ? { patientId: searchParams.patient } : undefined,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        records: { select: { id: true, cost: true, status: true, treatmentType: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Treatment plans"
        subtitle={`${plans.filter((p) => p.status === "ACTIVE").length} active plans`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {plans.length === 0 && <Empty>No treatment plans yet.</Empty>}
          {plans.map((plan) => {
            const total = plan.records.reduce((s, r) => s + r.cost, 0);
            const done = plan.records.filter((r) => r.status === "COMPLETED").length;
            const pct = plan.records.length ? Math.round((done / plan.records.length) * 100) : 0;
            return (
              <div key={plan.id} className="card fade-in p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/plans/${plan.id}`} className="font-medium hover:underline">
                        {plan.title}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[plan.status]}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm">
                      <Link href={`/patients/${plan.patient.id}`} className="text-muted hover:underline">
                        {fullName(plan.patient)}
                      </Link>
                    </div>
                    {plan.records.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs text-muted">
                          <span>{done}/{plan.records.length} steps complete</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {plan.records.map((r) => (
                            <span key={r.id} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              r.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                              r.status === "IN_PROGRESS" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                              "bg-muted/20 text-muted"
                            }`}>
                              {r.treatmentType.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.notes && <p className="mt-1 text-xs text-muted">{plan.notes}</p>}
                    <p className="mt-0.5 text-xs text-muted">Created {fmtDate(plan.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {total > 0 && <div className="text-base font-semibold">{formatMoney(total)}</div>}
                    <Link href={`/plans/${plan.id}`} className="btn-ghost btn-sm mt-1 block">View →</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Card title="New treatment plan">
          <form action={createTreatmentPlan} className="space-y-3 p-5">
            <Field label="Patient">
              <select name="patientId" required className="input">
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{fullName(p)}</option>
                ))}
              </select>
            </Field>
            <Field label="Plan title">
              <input name="title" required className="input" placeholder="e.g. Full-mouth rehabilitation" />
            </Field>
            <Field label="Notes (optional)">
              <textarea name="notes" className="input min-h-[72px]" placeholder="Overview of the treatment sequence…" />
            </Field>
            <button className="btn-primary w-full">Create plan</button>
          </form>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { createLabOrder, updateLabOrderStatus } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  SENT: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  RECEIVED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-rose-500/15 text-rose-500",
};

const NEXT_STATUS: Record<string, string> = {
  SENT: "RECEIVED",
  RECEIVED: "APPROVED",
};

const NEXT_LABEL: Record<string, string> = {
  SENT: "Mark received",
  RECEIVED: "Approve",
};

export default async function LabPage({ searchParams }: { searchParams: { status?: string } }) {
  const filterStatus = searchParams.status ?? null;

  const [orders, patients, records] = await Promise.all([
    prisma.labOrder.findMany({
      where: filterStatus ? { status: filterStatus as "SENT" | "RECEIVED" | "APPROVED" | "REJECTED" } : undefined,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatmentRecord: { include: { treatmentType: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.treatmentRecord.findMany({
      orderBy: { performedAt: "desc" },
      take: 200,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        treatmentType: { select: { name: true } },
      },
    }),
  ]);

  const now = new Date();
  const activeOrders = orders.filter((o) => o.status === "SENT" || o.status === "RECEIVED");
  const overdueCount = activeOrders.filter((o) => o.dueAt && o.dueAt < now).length;

  return (
    <>
      <PageHeader
        title="Lab orders"
        subtitle={`${activeOrders.length} active · ${overdueCount} overdue`}
        actions={
          <div className="flex gap-1.5">
            {[null, "SENT", "RECEIVED", "APPROVED", "REJECTED"].map((s) => (
              <Link
                key={s ?? "all"}
                href={s ? `/lab?status=${s}` : "/lab"}
                className={`btn-ghost btn-sm ${filterStatus === s || (!filterStatus && !s) ? "bg-brand-soft text-brand" : ""}`}
              >
                {s ?? "All"}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {orders.length === 0 && <Empty>No lab orders{filterStatus ? ` with status ${filterStatus}` : ""}.</Empty>}
          {orders.map((order) => {
            const isOverdue = order.dueAt && order.dueAt < now && (order.status === "SENT" || order.status === "RECEIVED");
            return (
              <div key={order.id} className={`card fade-in p-4 ${isOverdue ? "border-rose-500/40" : ""}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{order.labName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[order.status]}`}>
                        {order.status}
                      </span>
                      {isOverdue && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-rose-500/15 text-rose-500">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm">
                      <Link href={`/patients/${order.patient.id}`} className="hover:underline">
                        {fullName(order.patient)}
                      </Link>
                      {order.treatmentRecord && (
                        <span className="text-muted"> · {order.treatmentRecord.treatmentType.name}</span>
                      )}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      {order.material && <span>Material: {order.material}</span>}
                      {order.shade && <span>Shade: {order.shade}</span>}
                      <span>Sent: {fmtDate(order.sentAt)}</span>
                      {order.dueAt && <span className={isOverdue ? "text-rose-500 font-medium" : ""}>Due: {fmtDate(order.dueAt)}</span>}
                      {order.receivedAt && <span>Received: {fmtDate(order.receivedAt)}</span>}
                    </div>
                    {order.notes && <p className="mt-1 text-xs text-muted">{order.notes}</p>}
                  </div>
                  {NEXT_STATUS[order.status] && (
                    <form action={updateLabOrderStatus} className="shrink-0">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value={NEXT_STATUS[order.status]} />
                      <button className="btn-ghost btn-sm">{NEXT_LABEL[order.status]}</button>
                    </form>
                  )}
                  {order.status !== "REJECTED" && order.status !== "APPROVED" && (
                    <form action={updateLabOrderStatus} className="shrink-0">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="REJECTED" />
                      <button className="btn-ghost btn-sm text-rose-500">Reject</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Card title="New lab order">
          <form action={createLabOrder} className="space-y-3 p-5">
            <Field label="Patient">
              <select name="patientId" required className="input">
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{fullName(p)}</option>
                ))}
              </select>
            </Field>
            <Field label="Link to treatment record (optional)">
              <select name="treatmentRecordId" className="input">
                <option value="">— none —</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fullName(r.patient)} · {r.treatmentType.name} · {fmtDate(r.performedAt)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lab name">
              <input name="labName" required className="input" placeholder="e.g. DentalLab Pro" />
            </Field>
            <Field label="Material (optional)">
              <input name="material" className="input" placeholder="e.g. Zirconia, PFM" />
            </Field>
            <Field label="Shade (optional)">
              <input name="shade" className="input" placeholder="e.g. A2, B1" />
            </Field>
            <Field label="Due date (optional)">
              <input name="dueAt" type="date" className="input" />
            </Field>
            <Field label="Notes (optional)">
              <input name="notes" className="input" placeholder="Special instructions…" />
            </Field>
            <button className="btn-primary w-full">Create order</button>
          </form>
        </Card>
      </div>
    </>
  );
}

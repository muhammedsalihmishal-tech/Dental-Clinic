import Link from "next/link";
import { FileText, Send, CheckCircle, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { createInvoice, updateInvoiceStatus, sendInvoiceMessage } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted/30 text-muted",
  SENT: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  PAID: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  VOID: "bg-rose-500/15 text-rose-500 line-through",
};

export default async function InvoicesPage({ searchParams }: { searchParams: { patient?: string } }) {
  const [invoices, patients, treatments, records] = await Promise.all([
    prisma.invoice.findMany({
      where: searchParams.patient ? { patientId: searchParams.patient } : undefined,
      include: {
        patient: true,
        treatmentRecord: { include: { treatmentType: true, doctor: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.patient.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    prisma.treatmentType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.treatmentRecord.findMany({
      where: { invoice: null },
      include: { patient: { select: { id: true, firstName: true, lastName: true } }, treatmentType: true },
      orderBy: { performedAt: "desc" },
      take: 100,
    }),
  ]);

  const unpaid = invoices.filter((i) => i.status !== "PAID" && i.status !== "VOID");
  const totalUnpaid = unpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${unpaid.length} unpaid · ${formatMoney(totalUnpaid)} outstanding`}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {invoices.length === 0 && <Empty>No invoices yet.</Empty>}
          {invoices.map((inv) => (
            <div key={inv.id} className="card fade-in p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{inv.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <Link href={`/patients/${inv.patient.id}`} className="font-medium hover:underline">{fullName(inv.patient)}</Link>
                    {inv.treatmentRecord && (
                      <span className="text-muted"> · {inv.treatmentRecord.treatmentType.name} with {inv.treatmentRecord.doctor.name}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">Issued {fmtDate(inv.issuedAt)}{inv.paidAt ? ` · Paid ${fmtDate(inv.paidAt)}` : ""}</div>
                  {inv.notes && <div className="mt-1 text-xs text-muted">{inv.notes}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-semibold">{formatMoney(inv.amount)}</div>
                  <div className="mt-1 flex gap-1 justify-end">
                    {inv.status === "DRAFT" && (
                      <form action={sendInvoiceMessage}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button className="btn-ghost btn-sm gap-1" title="Send to patient"><Send className="h-3.5 w-3.5" />Send</button>
                      </form>
                    )}
                    {(inv.status === "DRAFT" || inv.status === "SENT") && (
                      <form action={updateInvoiceStatus}>
                        <input type="hidden" name="id" value={inv.id} />
                        <input type="hidden" name="status" value="PAID" />
                        <button className="btn-ghost btn-sm gap-1 text-emerald-600" title="Mark paid"><CheckCircle className="h-3.5 w-3.5" />Paid</button>
                      </form>
                    )}
                    {inv.status !== "VOID" && inv.status !== "PAID" && (
                      <form action={updateInvoiceStatus}>
                        <input type="hidden" name="id" value={inv.id} />
                        <input type="hidden" name="status" value="VOID" />
                        <button className="btn-ghost btn-sm gap-1 text-rose-500" title="Void"><XCircle className="h-3.5 w-3.5" />Void</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card title="New invoice">
          <form action={createInvoice} className="space-y-3 p-5">
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
            <Field label="Amount (₹)">
              <input name="amount" type="number" min={0} required className="input" placeholder="0" />
            </Field>
            <Field label="Notes (optional)">
              <input name="notes" className="input" placeholder="e.g. includes X-ray" />
            </Field>
            <button className="btn-primary w-full">Create invoice</button>
          </form>
        </Card>
      </div>
    </>
  );
}

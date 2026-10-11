import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, Send, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { fmtDate } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { updateInvoiceStatus, sendInvoiceMessage } from "@/app/actions";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  VOID: "Void",
};

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, clinic] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: true,
        treatmentRecord: { include: { treatmentType: true, doctor: true } },
      },
    }),
    getClinic(),
  ]);

  if (!inv) notFound();

  const isPaid = inv.status === "PAID";
  const isVoid = inv.status === "VOID";
  const canPay = inv.status === "DRAFT" || inv.status === "SENT";
  const canSend = inv.status === "DRAFT";
  const canVoid = !isPaid && !isVoid;

  return (
    <>
      {/* Screen-only controls */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/invoices" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex gap-2">
          {canSend && (
            <form action={sendInvoiceMessage}>
              <input type="hidden" name="id" value={inv.id} />
              <button className="btn-ghost gap-1.5">
                <Send className="h-4 w-4" /> Send to patient
              </button>
            </form>
          )}
          {canPay && (
            <form action={updateInvoiceStatus}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="status" value="PAID" />
              <button className="btn-ghost gap-1.5 text-emerald-600">
                <CheckCircle className="h-4 w-4" /> Mark paid
              </button>
            </form>
          )}
          {canVoid && (
            <form action={updateInvoiceStatus}>
              <input type="hidden" name="id" value={inv.id} />
              <input type="hidden" name="status" value="VOID" />
              <button className="btn-ghost gap-1.5 text-rose-500">
                <XCircle className="h-4 w-4" /> Void
              </button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Invoice document */}
      <div
        id="invoice-doc"
        className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none print:p-0"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-bold">{clinic.name}</div>
            {clinic.address && <div className="mt-0.5 text-sm text-muted">{clinic.address}</div>}
            {clinic.phone && <div className="text-sm text-muted">{clinic.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight">{inv.number}</div>
            <div
              className={[
                "mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isPaid
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : isVoid
                    ? "bg-rose-500/15 text-rose-600"
                    : inv.status === "SENT"
                      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
                      : "bg-muted/30 text-muted",
              ].join(" ")}
            >
              {STATUS_LABEL[inv.status]}
            </div>
          </div>
        </div>

        <hr className="my-6 border-border" />

        {/* Bill to / dates */}
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Bill to</div>
            <div className="font-semibold">{fullName(inv.patient)}</div>
            {inv.patient.phone && <div className="text-muted">{inv.patient.phone}</div>}
            {inv.patient.email && <div className="text-muted">{inv.patient.email}</div>}
            {inv.patient.address && <div className="mt-1 text-muted">{inv.patient.address}</div>}
          </div>
          <div className="text-right">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Dates</div>
            <div><span className="text-muted">Issued:</span> {fmtDate(inv.issuedAt)}</div>
            {inv.paidAt && <div className="text-emerald-600 dark:text-emerald-400"><span className="text-muted">Paid:</span> {fmtDate(inv.paidAt)}</div>}
          </div>
        </div>

        <hr className="my-6 border-border" />

        {/* Line items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3">
                {inv.treatmentRecord ? (
                  <>
                    <div className="font-medium">{inv.treatmentRecord.treatmentType.name}</div>
                    <div className="text-xs text-muted">
                      {inv.treatmentRecord.doctor.name}
                      {inv.treatmentRecord.performedAt && ` · ${fmtDate(inv.treatmentRecord.performedAt)}`}
                      {inv.treatmentRecord.teeth && ` · Teeth: ${inv.treatmentRecord.teeth}`}
                    </div>
                  </>
                ) : (
                  <span className="font-medium">Dental services</span>
                )}
                {inv.notes && <div className="mt-0.5 text-xs text-muted">{inv.notes}</div>}
              </td>
              <td className="py-3 text-right font-semibold">{formatMoney(inv.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="pt-3 text-right text-sm font-semibold text-muted">Total</td>
              <td className="pt-3 text-right text-lg font-bold">{formatMoney(inv.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-8 rounded-xl bg-surface-2 p-4 text-center text-xs text-muted print:bg-transparent print:border print:border-border">
          {isPaid
            ? "Thank you for your payment!"
            : `Please settle the amount of ${formatMoney(inv.amount)} at your earliest convenience.`}
          {clinic.phone && !isPaid && <span> Call us at {clinic.phone} for any queries.</span>}
        </div>
      </div>

    </>
  );
}

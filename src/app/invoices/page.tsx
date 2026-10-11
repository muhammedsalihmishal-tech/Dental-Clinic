import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { updateInvoiceStatus, sendInvoiceMessage } from "@/app/actions";
import type { InvoiceStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const STATUS_TONE: Record<InvoiceStatus, "gray" | "violet" | "emerald" | "rose"> = {
  DRAFT: "gray",
  SENT: "violet",
  PAID: "emerald",
  VOID: "gray",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  VOID: "Void",
};

type Filter = "all" | "outstanding" | "overdue" | "paid";

export default async function InvoicesPage({ searchParams }: { searchParams: { filter?: string } }) {
  const filter = (searchParams.filter ?? "all") as Filter;
  const now = new Date();
  const overdueThreshold = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [allInvoices, totalOutstanding, totalPaidThisMonth, overdueCount] = await Promise.all([
    prisma.invoice.findMany({
      include: { patient: true },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["DRAFT", "SENT"] } },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.count({
      where: { status: "SENT", issuedAt: { lt: overdueThreshold } },
    }),
  ]);

  const filtered = allInvoices.filter((inv) => {
    if (filter === "outstanding") return inv.status === "DRAFT" || inv.status === "SENT";
    if (filter === "overdue") return inv.status === "SENT" && inv.issuedAt < overdueThreshold;
    if (filter === "paid") return inv.status === "PAID";
    return true;
  });

  const outstanding = (totalOutstanding._sum.amount ?? 0);
  const paidThisMonth = (totalPaidThisMonth._sum.amount ?? 0);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "outstanding", label: "Outstanding" },
    { key: "overdue", label: "Overdue" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <>
      <PageHeader title="Invoices" subtitle="All patient invoices and payment status." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={formatMoney(outstanding)} hint="Draft + sent invoices" icon={Clock} tone="violet" />
        <StatCard label="Paid this month" value={formatMoney(paidThisMonth)} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Overdue (30+ days)" value={overdueCount} hint="Sent, not yet paid" icon={AlertCircle} tone={overdueCount > 0 ? "rose" : "gray"} />
      </div>

      <Card>
        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-border px-4 pt-3 pb-0">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/invoices?filter=${t.key}`}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm font-medium transition",
                filter === t.key
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted hover:text-fg",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty>No invoices match this filter.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Issued</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inv) => {
                  const isOverdue = inv.status === "SENT" && inv.issuedAt < overdueThreshold;
                  return (
                    <tr key={inv.id} className="hover:bg-surface-2/40">
                      <td className="px-5 py-3 font-mono text-xs font-semibold tabular-nums">
                        {inv.number}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/patients/${inv.patientId}`} className="hover:text-brand font-medium">
                          {fullName(inv.patient)}
                        </Link>
                      </td>
                      <td className="px-5 py-3 tabular-nums">{formatMoney(inv.amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                          {isOverdue && <Badge tone="rose">Overdue</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted">{fmtDate(inv.issuedAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          {inv.status === "DRAFT" && (
                            <form action={sendInvoiceMessage}>
                              <input type="hidden" name="id" value={inv.id} />
                              <button className="btn-ghost btn-sm text-xs">Send</button>
                            </form>
                          )}
                          {inv.status === "SENT" && (
                            <form action={updateInvoiceStatus}>
                              <input type="hidden" name="id" value={inv.id} />
                              <input type="hidden" name="status" value="PAID" />
                              <button className="btn-ghost btn-sm text-xs text-emerald-600">Mark paid</button>
                            </form>
                          )}
                          {(inv.status === "DRAFT" || inv.status === "SENT") && (
                            <form action={updateInvoiceStatus}>
                              <input type="hidden" name="id" value={inv.id} />
                              <input type="hidden" name="status" value="VOID" />
                              <button className="btn-ghost btn-sm text-xs text-muted">Void</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

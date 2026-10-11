import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Avatar, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted/30 text-muted",
  SENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        include: { patient: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const seg = campaign.segment as { statuses?: string[]; tags?: string[]; lastSeenBeforeDays?: number };

  // Conversion: how many recipients booked within 14 days of send
  let conversions = new Set<string>();
  if (campaign.status === "SENT" && campaign.sentAt) {
    const cutoff = new Date(campaign.sentAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const recipientIds = campaign.messages.map((m) => m.patientId);
    const bookers = await prisma.appointment.findMany({
      where: {
        patientId: { in: recipientIds },
        createdAt: { gte: campaign.sentAt, lte: cutoff },
        status: { not: "HELD" },
      },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    conversions = new Set(bookers.map((b) => b.patientId));
  }

  const sentCount = campaign.messages.filter((m) => m.sent).length;
  const conversionCount = conversions.size;
  const conversionRate = sentCount > 0 ? Math.round((conversionCount / sentCount) * 100) : 0;

  return (
    <>
      <div className="mb-6">
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </div>

      <PageHeader
        title={campaign.name}
        subtitle={
          campaign.status === "SENT"
            ? `Sent ${fmtDateTime(campaign.sentAt!)}`
            : `Created ${fmtDateTime(campaign.createdAt)}`
        }
        actions={
          campaign.status === "SENT" ? (
            <a href={`/api/campaigns/${campaign.id}/export`} download className="btn-ghost gap-1.5">
              <Download className="h-4 w-4" /> Export CSV
            </a>
          ) : undefined
        }
      />

      {/* Summary stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-2xl font-bold">{campaign.messages.length}</div>
          <div className="text-sm text-muted">Recipients</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-emerald-600">{sentCount}</div>
          <div className="text-sm text-muted">Delivered</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-rose-600">{campaign.failCount}</div>
          <div className="text-sm text-muted">Failed</div>
        </div>
        {campaign.status === "SENT" && (
          <div className="card p-4">
            <div className="text-2xl font-bold" style={{ color: "var(--color-brand)" }}>{conversionRate}%</div>
            <div className="text-sm text-muted">
              Booked within 14d{" "}
              <span className="text-xs">({conversionCount})</span>
            </div>
          </div>
        )}
      </div>

      {/* Campaign details */}
      <div className="card mb-6 space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[campaign.status]}`}>
            {campaign.status}
          </span>
          <span className="text-sm text-muted">{campaign.channel}</span>
        </div>
        <div className="rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{campaign.message}</div>
        {(seg.statuses?.length || seg.tags?.length || seg.lastSeenBeforeDays) && (
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {seg.statuses?.length ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                Status: {seg.statuses.join(", ")}
              </span>
            ) : null}
            {seg.tags?.length ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                Tags: {seg.tags.join(", ")}
              </span>
            ) : null}
            {seg.lastSeenBeforeDays ? (
              <span className="rounded-full bg-surface-2 px-2 py-0.5">
                Not seen in {seg.lastSeenBeforeDays}d
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Recipient table */}
      {campaign.messages.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No recipients — this campaign has not been sent yet.
        </div>
      ) : (
        <div className="card overflow-x-auto fade-in">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="table-head">Patient</th>
                <th className="table-head hidden sm:table-cell">Phone</th>
                <th className="table-head">Delivered</th>
                {campaign.status === "SENT" && (
                  <th className="table-head">Booked after</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaign.messages.map((msg) => (
                <tr key={msg.id} className="hover:bg-surface-2/40">
                  <td className="table-cell">
                    <Link
                      href={`/patients/${msg.patientId}`}
                      className="flex items-center gap-2 hover:text-brand"
                    >
                      <Avatar name={fullName(msg.patient)} size="sm" />
                      <span className="font-medium">{fullName(msg.patient)}</span>
                    </Link>
                  </td>
                  <td className="table-cell hidden sm:table-cell text-muted">{msg.patient.phone}</td>
                  <td className="table-cell">
                    {msg.sent ? (
                      <span className="text-emerald-600 text-xs font-medium">✓ Sent</span>
                    ) : (
                      <span className="text-rose-500 text-xs font-medium" title={msg.error ?? undefined}>
                        ✗ Failed
                      </span>
                    )}
                  </td>
                  {campaign.status === "SENT" && (
                    <td className="table-cell">
                      {conversions.has(msg.patientId) ? (
                        <span className="text-xs font-medium" style={{ color: "var(--color-brand)" }}>
                          Booked ✓
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

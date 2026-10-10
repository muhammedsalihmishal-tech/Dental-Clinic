import Link from "next/link";
import { Bot, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { CallBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const [calls, total, booked, emergencies] = await Promise.all([
    prisma.callLog.findMany({ include: { patient: true }, orderBy: { startedAt: "desc" }, take: 100 }),
    prisma.callLog.count(),
    prisma.callLog.count({ where: { outcome: { in: ["BOOKED", "RESCHEDULED"] } } }),
    prisma.callLog.count({ where: { outcome: "EMERGENCY" } }),
  ]);
  const rate = total ? Math.round((booked / total) * 100) : 0;

  return (
    <>
      <PageHeader title="AI receptionist calls" subtitle="Every call the voice agent handled, with summary and transcript." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Calls handled" value={total} icon={Bot} tone="indigo" />
        <StatCard label="Booking conversion" value={`${rate}%`} hint={`${booked} booked or rescheduled`} icon={PhoneIncoming} />
        <StatCard label="Emergencies escalated" value={emergencies} icon={PhoneOutgoing} tone="rose" />
      </div>
      <Card>
        {calls.length === 0 ? <Empty>No calls yet. Point your voice agent&apos;s webhook at /api/voice/webhook.</Empty> : (
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  {c.direction === "INBOUND" ? <PhoneIncoming className="h-4 w-4 text-brand" /> : <PhoneOutgoing className="h-4 w-4 text-indigo-500" />}
                  {c.patient ? (
                    <Link href={`/patients/${c.patientId}`} className="font-medium hover:text-brand">{fullName(c.patient)}</Link>
                  ) : (
                    <span className="font-medium">{c.phone} <span className="text-xs font-normal text-muted">(unknown caller)</span></span>
                  )}
                  <CallBadge outcome={c.outcome} />
                  <span className="ml-auto text-xs text-muted">
                    {fmtDateTime(c.startedAt)} · {Math.floor(c.durationSec / 60)}m {c.durationSec % 60}s
                  </span>
                </div>
                {c.summary && <p className="mt-2 text-sm">{c.summary}</p>}
                {(c.transcript || c.recordingUrl) && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-brand">Transcript & recording</summary>
                    {c.recordingUrl && <audio controls src={c.recordingUrl} className="mt-2 w-full max-w-md" />}
                    {c.transcript && <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs">{c.transcript}</pre>}
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

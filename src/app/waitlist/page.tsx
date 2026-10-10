import Link from "next/link";
import { ClipboardList, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { addToWaitlist, removeFromWaitlist, notifyWaitlistPatient } from "./actions";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const [entries, treatments, doctors, patients] = await Promise.all([
    prisma.waitlist.findMany({
      include: { patient: true, treatmentType: true, doctor: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.patient.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 200 }),
  ]);

  const waiting = entries.filter((e) => !e.notified);
  const notified = entries.filter((e) => e.notified);

  return (
    <>
      <PageHeader
        title="Waitlist"
        subtitle={`${waiting.length} waiting · ${notified.length} notified`}
        icon={ClipboardList}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card
            title={`Waiting (${waiting.length})`}
            action={
              <span className="text-xs text-muted">Oldest first — notify when a slot opens</span>
            }
          >
            {waiting.length === 0 ? (
              <Empty>No one waiting right now.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {waiting.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-3">
                    <Avatar name={fullName(entry.patient)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/patients/${entry.patientId}`} className="text-sm font-medium hover:text-brand">
                          {fullName(entry.patient)}
                        </Link>
                      </div>
                      <div className="text-xs text-muted">
                        {entry.treatmentType.name}
                        {entry.doctor && ` · ${entry.doctor.name}`}
                        {entry.notes && ` · ${entry.notes}`}
                      </div>
                      <div className="text-xs text-muted">Added {fmtDate(entry.createdAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <form action={notifyWaitlistPatient}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button className="btn-primary btn-sm">Notify</button>
                      </form>
                      <form action={removeFromWaitlist}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button className="btn-ghost btn-sm text-rose-500">Remove</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {notified.length > 0 && (
            <Card title={`Notified (${notified.length})`}>
              <ul className="divide-y divide-border">
                {notified.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                    <Avatar name={fullName(entry.patient)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{fullName(entry.patient)}</div>
                      <div className="text-xs text-muted">
                        {entry.treatmentType.name}
                        {entry.doctor && ` · ${entry.doctor.name}`}
                      </div>
                    </div>
                    <Badge tone="emerald">Notified</Badge>
                    <form action={removeFromWaitlist}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button className="btn-ghost btn-sm">Dismiss</button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div>
          <Card title={<span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-brand" /> Add to waitlist</span>}>
            <form action={addToWaitlist} className="space-y-3 p-5">
              <Field label="Patient">
                <select name="patientId" className="input" required>
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{fullName(p)} · {p.phone}</option>
                  ))}
                </select>
              </Field>
              <Field label="Treatment">
                <select name="treatmentTypeId" className="input" required>
                  <option value="">Select treatment…</option>
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred doctor (optional)">
                <select name="doctorId" className="input">
                  <option value="">Any doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Notes">
                <textarea name="notes" rows={2} className="input" placeholder="Any time preference or notes…" />
              </Field>
              <button className="btn-primary w-full">Add to waitlist</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

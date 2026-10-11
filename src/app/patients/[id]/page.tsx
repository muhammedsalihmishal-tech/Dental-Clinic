import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Bell, Bot, CalendarPlus, FileText, Mail, MessageCircle, MessageSquare, Pencil, Phone, PhoneCall, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtDateTime, todayString } from "@/lib/time";
import { formatMoney, fullName, titleCase, CHANNEL_LABEL } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, Field } from "@/components/ui";
import { AppointmentBadge, CallBadge, PatientBadge, ReminderBadge } from "@/components/badges";
import { addNote, createTask, recordTreatment } from "@/app/actions";
import { noShowRiskScore } from "@/lib/risk";

export const dynamic = "force-dynamic";

type Event = { at: Date; icon: ReactNode; title: ReactNode; body?: ReactNode; meta?: ReactNode };

export default async function PatientPage({ params }: { params: { id: string } }) {
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      appointments: { include: { doctor: true, treatmentType: true }, orderBy: { start: "desc" } },
      records: { include: { doctor: true, treatmentType: true }, orderBy: { performedAt: "desc" } },
      reminders: { include: { rule: true }, orderBy: { scheduledFor: "desc" } },
      calls: { orderBy: { startedAt: "desc" } },
      timelineNotes: { orderBy: { createdAt: "desc" } },
      tasks: { where: { done: false } },
    },
  });
  if (!patient) notFound();
  const [treatments, doctors, inboundMessages] = await Promise.all([
    prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inboundMessage.findMany({ where: { from: patient.phone }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const now = new Date();
  const risk = noShowRiskScore(patient);
  const upcoming = patient.appointments
    .filter((a) => a.start > now && (["SCHEDULED", "CONFIRMED"].includes(a.status) || (a.status === "HELD" && a.holdExpiresAt! > now)))
    .reverse();
  const lifetime = patient.records.filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.cost, 0);
  const visits = patient.appointments.filter((a) => a.status === "COMPLETED").length;
  const noShows = patient.appointments.filter((a) => a.status === "NO_SHOW").length;

  const events: Event[] = [
    ...patient.appointments
      .filter((a) => a.status !== "HELD" && (a.start <= now || !["SCHEDULED", "CONFIRMED"].includes(a.status)))
      .map((a) => ({
        at: a.start,
        icon: <CalendarPlus className="h-3.5 w-3.5" />,
        title: (
          <>
            {a.treatmentType.name} with {a.doctor.name} <AppointmentBadge status={a.status} />
          </>
        ),
        body: a.notes,
        meta: a.source === "VOICE_AI" ? "Booked by AI receptionist" : undefined,
      })),
    ...patient.records
      .filter((r) => !r.appointmentId)
      .map((r) => ({
        at: r.performedAt,
        icon: <Stethoscope className="h-3.5 w-3.5" />,
        title: <>{r.treatmentType.name} recorded · {titleCase(r.status)}</>,
        body: [r.teeth && `Teeth: ${r.teeth}`, r.notes].filter(Boolean).join(" · ") || undefined,
        meta: `${r.doctor.name} · ${formatMoney(r.cost)}`,
      })),
    ...patient.calls.map((c) => ({
      at: c.startedAt,
      icon: <PhoneCall className="h-3.5 w-3.5" />,
      title: (
        <>
          {c.direction === "INBOUND" ? "Inbound" : "Outbound"} AI call <CallBadge outcome={c.outcome} />
        </>
      ),
      body: c.summary,
      meta: `${Math.floor(c.durationSec / 60)}m ${c.durationSec % 60}s`,
    })),
    ...patient.reminders
      .filter((r) => r.status !== "PENDING")
      .map((r) => ({
        at: r.sentAt ?? r.scheduledFor,
        icon: <MessageCircle className="h-3.5 w-3.5" />,
        title: (
          <>
            {r.rule?.name ?? "Message"} via {CHANNEL_LABEL[r.channel]} <ReminderBadge status={r.status} />
          </>
        ),
        body: r.message,
        meta: r.error ?? undefined,
      })),
    ...patient.timelineNotes.map((n) => ({
      at: n.createdAt,
      icon: <FileText className="h-3.5 w-3.5" />,
      title: <>Note by {n.author}</>,
      body: n.body,
    })),
    ...inboundMessages.map((m) => ({
      at: m.createdAt,
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      title: <>Reply via {CHANNEL_LABEL[m.channel as "SMS" | "WHATSAPP" | "EMAIL" | "CALL"]}</>,
      body: m.body,
      meta: m.intent ?? undefined,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const pending = patient.reminders.filter((r) => r.status === "PENDING").reverse();

  return (
    <>
      <div className="card fade-in mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-teal-500/25 via-sky-500/15 to-indigo-500/25" />
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-4 px-6 pb-5">
          <div className="flex items-end gap-4">
            <div className="rounded-full ring-4 ring-surface">
              <Avatar name={fullName(patient)} size="lg" />
            </div>
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{fullName(patient)}</h1>
                <PatientBadge status={patient.status} />
                {patient.tags.map((t) => <Badge key={t}>{t}</Badge>)}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>
                {patient.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {patient.email}</span>}
                <span>Prefers {CHANNEL_LABEL[patient.preferredChannel]} · {patient.language}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/patients/${patient.id}/edit`} className="btn-ghost"><Pencil className="h-4 w-4" /> Edit</Link>
            <Link href={`/appointments/new?patientId=${patient.id}`} className="btn-primary"><CalendarPlus className="h-4 w-4" /> Book</Link>
          </div>
        </div>
        {(patient.medicalAlerts || patient.allergies) && (
          <div className="border-t border-rose-500/20 bg-rose-500/5 px-6 py-3 text-sm text-rose-600 dark:text-rose-300">
            ⚠ {[patient.medicalAlerts, patient.allergies && `Allergies: ${patient.allergies}`].filter(Boolean).join(" · ")}
          </div>
        )}
        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-5">
          {[
            ["Visits", visits],
            ["Lifetime value", formatMoney(lifetime)],
            ["No-shows", noShows],
            ["Patient since", fmtDate(patient.createdAt)],
          ].map(([k, v]) => (
            <div key={k} className="border-border px-6 py-3 [&:not(:first-child)]:border-l">
              <div className="text-xs text-muted">{k}</div>
              <div className="text-sm font-semibold">{v}</div>
            </div>
          ))}
          <div className="border-border px-6 py-3 [&:not(:first-child)]:border-l">
            <div className="text-xs text-muted">No-show risk</div>
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: risk.color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: risk.color }} />
              {risk.label} ({risk.score})
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Upcoming appointments">
            {upcoming.length === 0 ? (
              <Empty>Nothing booked.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{fmtDateTime(a.start)}</span>
                      <AppointmentBadge status={a.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                      {a.source === "VOICE_AI" && <Bot className="h-3 w-3" />} {a.treatmentType.name} · {a.doctor.name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={<span className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /> Scheduled follow-ups</span>}>
            {pending.length === 0 ? (
              <Empty>No follow-ups queued.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {pending.map((r) => (
                  <li key={r.id} className="px-5 py-3 text-sm">
                    <div className="font-medium">{r.rule?.name ?? "Message"}</div>
                    <div className="text-xs text-muted">{fmtDateTime(r.scheduledFor)} · {CHANNEL_LABEL[r.channel]}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Record a treatment">
            <form action={recordTreatment} className="space-y-3 p-5">
              <input type="hidden" name="patientId" value={patient.id} />
              <Field label="Treatment">
                <select name="treatmentTypeId" className="input" required>
                  {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Doctor">
                  <select name="doctorId" className="input" required>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" className="input">
                    <option value="COMPLETED">Completed</option><option value="IN_PROGRESS">In progress</option><option value="PLANNED">Planned</option>
                  </select>
                </Field>
                <Field label="Date"><input type="date" name="performedAt" defaultValue={todayString()} className="input" /></Field>
                <Field label="Teeth"><input name="teeth" placeholder="e.g. 36, 37" className="input" /></Field>
              </div>
              <Field label="Clinical notes"><textarea name="notes" rows={2} className="input" /></Field>
              <p className="text-xs text-muted">Completed treatments automatically queue their follow-up messages.</p>
              <button className="btn-primary w-full">Save treatment</button>
            </form>
          </Card>

          <Card title="Profile">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-sm">
              {[
                ["Date of birth", patient.dateOfBirth ? fmtDate(patient.dateOfBirth) : "—"],
                ["Gender", patient.gender ?? "—"],
                ["Insurance", patient.insurance ?? "—"],
                ["Automated messages", patient.optOut ? "Opted out" : "Allowed"],
                ["Address", patient.address ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Add to timeline">
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <form action={addNote} className="space-y-2">
                <input type="hidden" name="patientId" value={patient.id} />
                <textarea name="body" rows={2} placeholder="Write a note…" className="input" />
                <button className="btn-ghost btn-sm">Add note</button>
              </form>
              <form action={createTask} className="space-y-2">
                <input type="hidden" name="patientId" value={patient.id} />
                <input name="title" placeholder="Task, e.g. Call back about quote" className="input" />
                <div className="flex gap-2">
                  <select name="priority" className="input">
                    <option value="NORMAL">Normal</option><option value="URGENT">Urgent</option><option value="LOW">Low</option>
                  </select>
                  <button className="btn-ghost btn-sm whitespace-nowrap">Add task</button>
                </div>
                {patient.tasks.length > 0 && <p className="text-xs text-muted">{patient.tasks.length} open task(s) on the dashboard.</p>}
              </form>
            </div>
          </Card>

          <Card title="Timeline">
            {events.length === 0 ? (
              <Empty>No history yet.</Empty>
            ) : (
              <ol className="relative space-y-6 p-6 before:absolute before:bottom-6 before:left-[37px] before:top-6 before:w-px before:bg-border">
                {events.map((e, i) => (
                  <li key={i} className="relative flex gap-4">
                    <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-brand">{e.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">{e.title}</div>
                      <div className="text-xs text-muted">{fmtDateTime(e.at)}{e.meta ? ` · ${e.meta}` : ""}</div>
                      {e.body && <p className="mt-1.5 whitespace-pre-line rounded-xl bg-surface-2 px-3 py-2 text-sm">{e.body}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

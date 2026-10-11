import Link from "next/link";
import { Bell, Bot, CalendarCheck, CheckCircle2, PhoneIncoming, UserPlus, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addDays, clinicDateAt, fmtTime, todayString } from "@/lib/time";
import { formatMoney, fullName } from "@/lib/utils";
import { Avatar, Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { AppointmentBadge, CallBadge } from "@/components/badges";
import { completeTask, createTask } from "./actions";
import { noShowRiskScore } from "@/lib/risk";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: process.env.CLINIC_TIMEZONE ?? "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const today = todayString();
  const dayStart = clinicDateAt(today, 0);
  const dayEnd = clinicDateAt(addDays(today, 1), 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [todayAppts, aiBooked, newPatients, noShows, pendingReminders, calls, tasks, revenue] = await Promise.all([
    prisma.appointment.findMany({
      where: { start: { gte: dayStart, lt: dayEnd }, status: { notIn: ["CANCELLED", "HELD"] } },
      include: {
        patient: {
          include: {
            appointments: {
              where: { status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED"] } },
              select: { status: true, start: true },
            },
          },
        },
        doctor: true,
        treatmentType: true,
      },
      orderBy: { start: "asc" },
    }),
    prisma.appointment.count({ where: { source: "VOICE_AI", createdAt: { gte: weekAgo }, status: { not: "HELD" } } }),
    prisma.patient.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.appointment.count({ where: { status: "NO_SHOW", start: { gte: monthAgo } } }),
    prisma.reminder.count({ where: { status: "PENDING", scheduledFor: { lt: dayEnd } } }),
    prisma.callLog.findMany({ include: { patient: true }, orderBy: { startedAt: "desc" }, take: 5 }),
    prisma.task.findMany({ where: { done: false }, include: { patient: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 8 }),
    prisma.treatmentRecord.aggregate({ _sum: { cost: true }, where: { status: "COMPLETED", performedAt: { gte: monthAgo } } }),
  ]);

  const done = todayAppts.filter((a) => a.status === "COMPLETED").length;
  const unconfirmed = todayAppts.filter((a) => a.status === "SCHEDULED" && a.start > new Date()).length;

  return (
    <>
      <PageHeader
        title={`${greeting()} 👋`}
        subtitle={`${todayAppts.length} appointments today · ${done} completed · ${pendingReminders} follow-ups going out`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's appointments" value={todayAppts.length} hint={`${done} completed so far`} icon={CalendarCheck} />
        <StatCard label="Booked by AI (7 days)" value={aiBooked} hint="Voice receptionist" icon={Bot} tone="indigo" />
        <StatCard label="New patients (30 days)" value={newPatients} hint={`Revenue ${formatMoney(revenue._sum.cost ?? 0)}`} icon={UserPlus} tone="emerald" />
        <StatCard label="No-shows (30 days)" value={noShows} hint="Auto rebooking message sent" icon={UserX} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Today's schedule"
          action={
            <div className="flex items-center gap-3">
              {unconfirmed > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {unconfirmed} unconfirmed
                </span>
              )}
              <Link href="/calendar" className="text-xs font-medium text-brand">Open calendar →</Link>
            </div>
          }
        >
          {todayAppts.length === 0 ? (
            <Empty>No appointments today.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {todayAppts.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-14 shrink-0 text-xs font-semibold tabular-nums sm:w-16 sm:text-sm">{fmtTime(a.start)}</div>
                  <div className="h-10 w-1 rounded-full" style={{ background: a.treatmentType.color }} />
                  <Avatar name={fullName(a.patient)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/patients/${a.patientId}`} className="block truncate text-sm font-medium hover:text-brand">
                      {fullName(a.patient)}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      {a.treatmentType.name} · {a.doctor.name}
                    </div>
                  </div>
                  {a.source === "VOICE_AI" && (
                    <Badge tone="violet" className="hidden sm:inline-flex">
                      <Bot className="h-3 w-3" /> AI booked
                    </Badge>
                  )}
                  {a.patient.medicalAlerts && <Badge tone="rose" className="hidden md:inline-flex">⚠ {a.patient.medicalAlerts}</Badge>}
                  {(() => { const r = noShowRiskScore(a.patient); return r.score >= 25 ? <span className="hidden md:inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: r.color + "22", color: r.color }}>{r.label} risk</span> : null; })()}
                  {a.status === "SCHEDULED" && a.start > new Date() && (
                    <span className="hidden sm:inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Unconfirmed
                    </span>
                  )}
                  <AppointmentBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Tasks" action={<Badge tone="amber">{tasks.length} open</Badge>}>
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                <form action={completeTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="mt-0.5 text-muted transition hover:text-emerald-500" aria-label="Mark done">
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{t.title}</div>
                  {t.patient && (
                    <Link href={`/patients/${t.patientId}`} className="text-xs text-muted hover:text-brand">
                      {fullName(t.patient)}
                    </Link>
                  )}
                </div>
                {t.priority === "URGENT" && <Badge tone="rose">Urgent</Badge>}
              </li>
            ))}
            {tasks.length === 0 && <Empty>All caught up ✨</Empty>}
          </ul>
          <form action={createTask} className="flex gap-2 border-t border-border p-4">
            <input name="title" placeholder="Add a task…" className="input" />
            <button className="btn-ghost">Add</button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={
            <span className="flex items-center gap-2">
              <PhoneIncoming className="h-4 w-4 text-brand" /> Recent AI calls
            </span>
          }
          action={<Link href="/calls" className="text-xs font-medium text-brand">All calls →</Link>}
        >
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="flex items-start gap-4 px-5 py-3">
                <Avatar name={c.patient ? fullName(c.patient) : "?"} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.patient ? fullName(c.patient) : c.phone}</div>
                  <p className="line-clamp-2 text-xs text-muted">{c.summary ?? "No summary"}</p>
                </div>
                <CallBadge outcome={c.outcome} />
              </li>
            ))}
            {calls.length === 0 && <Empty>No calls yet. Connect your voice agent to start.</Empty>}
          </ul>
        </Card>
        <Card
          title={
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand" /> Automations
            </span>
          }
        >
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted">
              <span className="font-semibold text-fg">{pendingReminders}</span> reminders and follow-ups are scheduled to go out today.
            </p>
            <Link href="/reminders" className="btn-ghost w-full">
              Manage follow-up rules
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

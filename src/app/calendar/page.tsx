import Link from "next/link";
import { ChevronLeft, ChevronRight, Bot } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addDays, clinicDateAt, clinicMinuteOfDay, dayOfWeek, fmt, fmtTime, minutesToLabel, todayString } from "@/lib/time";
import { cn, fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { AppointmentBadge } from "@/components/badges";
import { updateAppointmentStatus } from "../actions";

export const dynamic = "force-dynamic";

const HOUR_PX = 88;

function weekStart(date: string): string {
  // Monday of the week containing `date`
  const d = new Date(`${date}T00:00:00`);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

export default async function CalendarPage({ searchParams }: { searchParams: { date?: string; view?: string } }) {
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayString();
  const view = searchParams.view === "week" ? "week" : "day";
  const today = todayString();

  if (view === "week") {
    const monday = weekStart(date);
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const weekStart_ = clinicDateAt(monday, 0);
    const weekEnd = clinicDateAt(addDays(monday, 7), 0);
    const prevWeek = addDays(monday, -7);
    const nextWeek = addDays(monday, 7);

    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        start: { gte: weekStart_, lt: weekEnd },
        status: { not: "CANCELLED" },
        NOT: { status: "HELD", holdExpiresAt: { lte: new Date() } },
      },
      include: { patient: true, doctor: true, treatmentType: true },
      orderBy: { start: "asc" },
    });

    // Group by date string
    const byDate: Record<string, typeof appointments> = {};
    for (const a of appointments) {
      const key = a.start.toISOString().slice(0, 10);
      (byDate[key] ??= []).push(a);
    }

    return (
      <>
        <PageHeader
          title="Calendar"
          subtitle={`Week of ${fmt(new Date(`${monday}T00:00:00`), "d MMMM yyyy")}`}
          actions={
            <>
              <Link href={`/calendar?view=week&date=${prevWeek}`} className="btn-ghost" aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Link>
              <Link href={`/calendar?view=week&date=${today}`} className="btn-ghost">This week</Link>
              <Link href={`/calendar?view=week&date=${nextWeek}`} className="btn-ghost" aria-label="Next week"><ChevronRight className="h-4 w-4" /></Link>
              <div className="flex gap-1 rounded-xl border border-border p-1">
                <Link href={`/calendar?date=${date}`} className="btn-ghost btn-sm">Day</Link>
                <Link href={`/calendar?view=week&date=${date}`} className="btn-primary btn-sm">Week</Link>
              </div>
            </>
          }
        />

        <div className="card fade-in overflow-x-auto">
          <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
            {weekDates.map((d) => {
              const isToday = d === today;
              const appts = byDate[d] ?? [];
              return (
                <div key={d} className={cn("border-border [&:not(:first-child)]:border-l", isToday && "bg-brand/5")}>
                  <div className={cn("flex items-center justify-between border-b border-border px-3 py-2", isToday && "border-brand/30")}>
                    <div className="text-xs">
                      <div className={cn("font-semibold", isToday && "text-brand")}>
                        {new Date(`${d}T00:00:00`).toLocaleString("en", { weekday: "short" })}
                      </div>
                      <div className="text-muted">{new Date(`${d}T00:00:00`).toLocaleString("en", { day: "numeric", month: "short" })}</div>
                    </div>
                    <Link href={`/calendar?date=${d}`} className="text-xs text-brand hover:underline">{appts.length > 0 ? `${appts.length} appt${appts.length === 1 ? "" : "s"}` : "+"}</Link>
                  </div>
                  <div className="min-h-[160px] space-y-1 p-2">
                    {appts.length === 0 && <div className="py-6 text-center text-xs text-muted">Free</div>}
                    {appts.map((a) => (
                      <Link
                        key={a.id}
                        href={`/calendar?date=${d}`}
                        className="block overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs transition hover:opacity-80"
                        style={{ borderColor: a.treatmentType.color, background: `${a.treatmentType.color}20` }}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          {a.source === "VOICE_AI" && <Bot className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{a.patient.firstName}</span>
                        </div>
                        <div className="truncate text-muted">{fmtTime(a.start)} · {a.doctor.name.split(" ")[1]}</div>
                        <AppointmentBadge status={a.status} />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Click on any day or appointment to open the day view. <Bot className="inline h-3 w-3" /> marks AI-booked appointments.
        </p>
      </>
    );
  }

  // ── Day view ──────────────────────────────────────────────────────────────
  const dayStart = clinicDateAt(date, 0);
  const dayEnd = clinicDateAt(addDays(date, 1), 0);
  const dow = dayOfWeek(date);

  const doctors = await prisma.doctor.findMany({
    where: { active: true },
    include: {
      workingHours: { where: { dayOfWeek: dow } },
      timeOff: { where: { start: { lt: dayEnd }, end: { gt: dayStart } } },
      appointments: {
        where: { start: { gte: dayStart, lt: dayEnd }, status: { not: "CANCELLED" }, NOT: { status: "HELD", holdExpiresAt: { lte: new Date() } } },
        include: { patient: true, treatmentType: true },
        orderBy: { start: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const allBlocks = doctors.flatMap((d) => d.workingHours);
  const apptMinutes = doctors.flatMap((d) => d.appointments.flatMap((a) => [clinicMinuteOfDay(a.start), clinicMinuteOfDay(a.end)]));
  const first = Math.floor(Math.min(8 * 60, ...allBlocks.map((b) => b.startMinute), ...apptMinutes) / 60);
  const last = Math.ceil(Math.max(19 * 60, ...allBlocks.map((b) => b.endMinute), ...apptMinutes) / 60);
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (min: number) => ((min - first * 60) / 60) * HOUR_PX;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={fmt(dayStart, "EEEE, d MMMM yyyy")}
        actions={
          <>
            <Link href={`/calendar?date=${addDays(date, -1)}`} className="btn-ghost" aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href="/calendar" className="btn-ghost">Today</Link>
            <Link href={`/calendar?date=${addDays(date, 1)}`} className="btn-ghost" aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <form className="flex gap-2">
              <input type="date" name="date" defaultValue={date} className="input w-auto" />
              <button className="btn-ghost">Go</button>
            </form>
            <div className="flex gap-1 rounded-xl border border-border p-1">
              <Link href={`/calendar?date=${date}`} className="btn-primary btn-sm">Day</Link>
              <Link href={`/calendar?view=week&date=${date}`} className="btn-ghost btn-sm">Week</Link>
            </div>
          </>
        }
      />

      <div className="card fade-in overflow-x-auto">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `64px repeat(${doctors.length}, minmax(200px, 1fr))` }}>
          <div className="border-b border-border" />
          {doctors.map((d) => (
            <div key={d.id} className="flex items-center gap-2 border-b border-l border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{d.name}</div>
                <div className="truncate text-xs text-muted">
                  {d.timeOff.length > 0 ? `Away · ${d.timeOff[0]!.reason ?? "Time off"}` : d.workingHours.length === 0 ? "Not working" : d.specialty}
                </div>
              </div>
            </div>
          ))}

          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-2 text-[11px] text-muted" style={{ top: top(h * 60) }}>
                {minutesToLabel(h * 60).replace(":00", "")}
              </div>
            ))}
          </div>

          {doctors.map((d) => (
            <div key={d.id} className="relative border-l border-border" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: top(h * 60) }} />
              ))}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(var(--surface-2))_6px,rgb(var(--surface-2))_12px)]" />
              {d.timeOff.length === 0 &&
                d.workingHours.map((w) => (
                  <div key={w.id} className="absolute inset-x-0 bg-surface" style={{ top: top(w.startMinute), height: top(w.endMinute) - top(w.startMinute) }} />
                ))}
              {d.appointments.map((a) => {
                const s = clinicMinuteOfDay(a.start);
                const e = clinicMinuteOfDay(a.end);
                return (
                  <details key={a.id} className="group absolute inset-x-1.5" style={{ top: top(s) + 1, height: Math.max(top(e) - top(s) - 2, 28) }}>
                    <summary
                      className={cn(
                        "h-full cursor-pointer list-none overflow-hidden rounded-xl border-l-4 px-2.5 py-1.5 text-xs shadow-sm transition hover:shadow-md",
                        a.status === "NO_SHOW" && "opacity-60",
                        a.status === "HELD" && "border-dashed",
                      )}
                      style={{ borderColor: a.treatmentType.color, background: `${a.treatmentType.color}1f` }}
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        {a.source === "VOICE_AI" && <Bot className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{fullName(a.patient)}</span>
                      </div>
                      <div className="truncate text-muted">
                        {fmtTime(a.start)} · {a.treatmentType.name}
                      </div>
                    </summary>
                    <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-border bg-surface p-3 text-xs shadow-xl">
                      <div className="mb-2 flex items-center justify-between">
                        <Link href={`/patients/${a.patientId}`} className="font-semibold hover:text-brand">
                          {fullName(a.patient)}
                        </Link>
                        <AppointmentBadge status={a.status} />
                      </div>
                      <div className="text-muted">
                        {fmtTime(a.start)} – {fmtTime(new Date(a.end.getTime() - a.treatmentType.bufferMinutes * 60_000))} · {a.patient.phone}
                      </div>
                      {a.notes && <p className="mt-1">{a.notes}</p>}
                      {a.patient.medicalAlerts && <p className="mt-1 text-rose-500">⚠ {a.patient.medicalAlerts}</p>}
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        {(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const)
                          .filter((s) => s !== a.status)
                          .map((s) => (
                            <form key={s} action={updateAppointmentStatus}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value={s} />
                              <button className="btn-ghost btn-sm w-full">
                                {{ CONFIRMED: "Confirm", COMPLETED: "Complete", NO_SHOW: "No-show", CANCELLED: "Cancel" }[s]}
                              </button>
                            </form>
                          ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Striped areas are outside working hours. <Bot className="inline h-3 w-3" /> marks bookings made by the AI receptionist. Click an appointment to update it.
      </p>
    </>
  );
}

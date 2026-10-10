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

export default async function CalendarPage({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayString();
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
              {/* Off-hours shading: everything outside working blocks */}
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

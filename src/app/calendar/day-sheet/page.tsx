import Link from "next/link";
import { Bot, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { addDays, clinicDateAt, fmtDate, fmtTime, todayString } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { AppointmentBadge } from "@/components/badges";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function DaySheetPage({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams.date ?? todayString();
  const dayStart = clinicDateAt(date, 0);
  const dayEnd = clinicDateAt(addDays(date, 1), 0);
  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  const [appointments, clinic] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        start: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED", "HELD"] },
      },
      include: {
        patient: true,
        doctor: true,
        treatmentType: true,
      },
      orderBy: { start: "asc" },
    }),
    getClinic(),
  ]);

  // Group by doctor
  const byDoctor = new Map<string, { doctor: { id: string; name: string; color: string }; appointments: typeof appointments }>();
  for (const appt of appointments) {
    if (!byDoctor.has(appt.doctorId)) {
      byDoctor.set(appt.doctorId, { doctor: appt.doctor, appointments: [] });
    }
    byDoctor.get(appt.doctorId)!.appointments.push(appt);
  }
  const groups = [...byDoctor.values()];

  return (
    <>
      {/* Screen controls — hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Link href={`/calendar/day-sheet?date=${prevDate}`} className="btn-ghost btn-sm p-2">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={`/calendar/day-sheet?date=${nextDate}`} className="btn-ghost btn-sm p-2">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">{fmtDate(dayStart)}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar" className="btn-ghost">← Calendar</Link>
          <PrintButton />
        </div>
      </div>

      {/* Printable document */}
      <div className="mx-auto max-w-4xl print:max-w-none">
        {/* Print header */}
        <div className="hidden print:block mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-bold">{clinic.name}</div>
              {clinic.address && <div className="text-sm text-gray-500">{clinic.address}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">Day Sheet</div>
              <div className="text-sm text-gray-500">{fmtDate(dayStart)}</div>
            </div>
          </div>
          <hr className="mt-4 border-gray-300" />
        </div>

        {appointments.length === 0 ? (
          <div className="card p-10 text-center text-sm text-muted print:border print:rounded-none">
            No appointments scheduled for {fmtDate(dayStart)}.
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ doctor, appointments: appts }) => (
              <div key={doctor.id} className="card print:border print:rounded-none print:shadow-none">
                {/* Doctor header */}
                <div
                  className="flex items-center gap-3 border-b border-border px-5 py-3 print:border-gray-300"
                >
                  <span
                    className="h-3 w-3 rounded-full print:hidden"
                    style={{ background: doctor.color }}
                  />
                  <span className="font-semibold">{doctor.name}</span>
                  <span className="ml-auto text-sm text-muted">{appts.length} appointment{appts.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Appointment rows */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted print:border-gray-200">
                      <th className="px-5 py-2">Time</th>
                      <th className="px-5 py-2">Patient</th>
                      <th className="px-5 py-2 hidden sm:table-cell">Treatment</th>
                      <th className="px-5 py-2 hidden md:table-cell">Phone</th>
                      <th className="px-5 py-2">Status</th>
                      <th className="px-5 py-2 hidden lg:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border print:divide-gray-200">
                    {appts.map((a) => (
                      <tr key={a.id} className="hover:bg-surface-2/40 print:hover:bg-transparent">
                        <td className="px-5 py-3 font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                          {fmtTime(a.start)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/patients/${a.patientId}`} className="font-medium hover:text-brand print:no-underline print:pointer-events-none">
                              {fullName(a.patient)}
                            </Link>
                            {a.source === "VOICE_AI" && <span title="Booked via AI receptionist"><Bot className="h-3.5 w-3.5 shrink-0 text-violet-500 print:hidden" /></span>}
                            {a.source === "ONLINE" && <span title="Booked online"><Globe className="h-3.5 w-3.5 shrink-0 text-teal-500 print:hidden" /></span>}
                          </div>
                          {a.patient.dateOfBirth && (
                            <div className="text-xs text-muted">
                              DOB: {fmtDate(a.patient.dateOfBirth)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          <div>{a.treatmentType.name}</div>
                          <div className="text-xs text-muted">{a.treatmentType.durationMinutes} min</div>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell text-muted">{a.patient.phone}</td>
                        <td className="px-5 py-3">
                          <AppointmentBadge status={a.status} />
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell text-xs text-muted max-w-xs truncate">
                          {a.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Summary footer */}
            <div className="flex justify-end gap-8 text-sm print:border-t print:border-gray-300 print:pt-4">
              <div><span className="text-muted">Total appointments:</span> <strong>{appointments.length}</strong></div>
              <div><span className="text-muted">Doctors:</span> <strong>{groups.length}</strong></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { CheckCircle2, CalendarDays, Clock, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { fmtTime } from "@/lib/time";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookSuccessPage({ searchParams }: { searchParams: { id?: string } }) {
  const clinic = await getClinic();
  const appt = searchParams.id
    ? await prisma.appointment.findUnique({
        where: { id: searchParams.id },
        include: {
          patient: true,
          doctor: true,
          treatmentType: true,
        },
      })
    : null;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Booking confirmed!</h1>
        <p className="text-muted text-sm mb-8">
          We&apos;ve received your appointment request. We&apos;ll send you a reminder before your visit.
        </p>

        {appt && (
          <div className="rounded-2xl border border-border bg-surface p-6 mb-8 text-left space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: appt.treatmentType.color }} />
              <span className="font-medium">{appt.treatmentType.name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <Stethoscope className="h-4 w-4" />
              {appt.doctor.name} · {appt.doctor.specialty}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <CalendarDays className="h-4 w-4" />
              {appt.start.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <Clock className="h-4 w-4" />
              {fmtTime(appt.start)} · {appt.treatmentType.durationMinutes} min
            </div>
            <div className="border-t border-border pt-3 text-xs text-muted">
              Booked for {fullName(appt.patient)}
            </div>
          </div>
        )}

        <p className="text-xs text-muted">
          Need to change or cancel? Call us at{" "}
          <span className="font-medium text-fg">{clinic.phone || clinic.name}</span>
        </p>
      </div>
    </div>
  );
}

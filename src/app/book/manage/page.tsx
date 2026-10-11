import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Stethoscope, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { fmtTime } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { verifyBookingToken } from "@/lib/tokens";
import { cancelBookingByToken } from "./actions";

export const dynamic = "force-dynamic";

export default async function ManageBookingPage({
  searchParams,
}: {
  searchParams: { token?: string; cancelled?: string; err?: string };
}) {
  const clinic = await getClinic();
  const { token, cancelled, err } = searchParams;

  const appointmentId = token ? verifyBookingToken(token) : null;
  const appt = appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { patient: true, doctor: true, treatmentType: true },
      })
    : null;

  const isCancelled = cancelled === "1" || appt?.status === "CANCELLED";
  const isExpired = appt && appt.start <= new Date() && !isCancelled;
  const canCancel = appt && ["SCHEDULED", "CONFIRMED"].includes(appt.status) && appt.start > new Date();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 text-white shadow-lg shadow-teal-500/20">
            🦷
          </div>
          <div>
            <div className="text-sm font-semibold">{clinic.name}</div>
            <div className="text-xs text-muted">Manage your booking</div>
          </div>
        </div>

        {!appointmentId || !appt ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
            <h1 className="text-lg font-semibold mb-2">Link not found</h1>
            <p className="text-sm text-muted mb-6">This booking link is invalid or has expired.</p>
            <Link href="/book" className="btn-primary">Book a new appointment</Link>
          </div>
        ) : isCancelled ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-semibold mb-2">Appointment cancelled</h1>
            <p className="text-sm text-muted mb-6">
              Your appointment has been cancelled. Need to rebook? Call us at{" "}
              <span className="font-medium text-fg">{clinic.phone || clinic.name}</span>.
            </p>
            <Link href="/book" className="btn-primary">Book a new appointment</Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
            <h1 className="text-base font-semibold">Your appointment</h1>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: appt.treatmentType.color }} />
                <span className="font-medium">{appt.treatmentType.name}</span>
              </div>
              <div className="flex items-center gap-3 text-muted">
                <Stethoscope className="h-4 w-4 shrink-0" />
                {appt.doctor.name} · {appt.doctor.specialty}
              </div>
              <div className="flex items-center gap-3 text-muted">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {appt.start.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              <div className="flex items-center gap-3 text-muted">
                <Clock className="h-4 w-4 shrink-0" />
                {fmtTime(appt.start)} · {appt.treatmentType.durationMinutes} min
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted">
                Booked for {fullName(appt.patient)}
              </div>
            </div>

            {err === "expired" && (
              <p className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-600">
                This appointment can no longer be cancelled online. Please call us.
              </p>
            )}

            {isExpired ? (
              <p className="text-sm text-muted text-center">
                This appointment is in the past. Call{" "}
                <span className="font-medium text-fg">{clinic.phone || clinic.name}</span> for help.
              </p>
            ) : canCancel ? (
              <form action={cancelBookingByToken}>
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                >
                  Cancel this appointment
                </button>
              </form>
            ) : null}

            <p className="text-xs text-muted text-center">
              Need to reschedule? Call us at{" "}
              <span className="font-medium text-fg">{clinic.phone || clinic.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDateTime, todayString } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";
import { AppointmentBadge } from "@/components/badges";
import { RescheduleForm } from "./RescheduleForm";

export const dynamic = "force-dynamic";

export default async function AppointmentPage({ params }: { params: { id: string } }) {
  const appt = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      doctor: true,
      treatmentType: { include: { doctors: { where: { active: true }, select: { id: true, name: true, color: true } } } },
    },
  });
  if (!appt) notFound();

  const canReschedule = ["SCHEDULED", "CONFIRMED"].includes(appt.status);

  return (
    <>
      <PageHeader
        title="Appointment"
        subtitle={`${appt.patient.firstName} ${appt.patient.lastName} · ${appt.treatmentType.name}`}
        actions={
          <Link href={`/patients/${appt.patient.id}`} className="btn-ghost">
            ← Patient profile
          </Link>
        }
      />

      <div className="mb-6">
        <Card title="Current booking">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Date &amp; time</p>
              <p className="mt-0.5 font-medium">{fmtDateTime(appt.start)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Doctor</p>
              <p className="mt-0.5 font-medium">{appt.doctor.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Treatment</p>
              <p className="mt-0.5 font-medium">{appt.treatmentType.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Status</p>
              <div className="mt-0.5"><AppointmentBadge status={appt.status} /></div>
            </div>
            {appt.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted">Notes</p>
                <p className="mt-0.5 text-sm">{appt.notes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {canReschedule ? (
        <Card title="Reschedule">
          <div className="p-5">
            <RescheduleForm
              appointmentId={appt.id}
              treatmentTypeId={appt.treatmentTypeId}
              doctors={appt.treatmentType.doctors}
              today={todayString()}
              currentDoctorId={appt.doctorId}
            />
          </div>
        </Card>
      ) : (
        <p className="text-sm text-muted">
          This appointment cannot be rescheduled (status: {appt.status.toLowerCase()}).
        </p>
      )}
    </>
  );
}

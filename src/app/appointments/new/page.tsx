import { prisma } from "@/lib/prisma";
import { todayString } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { BookingForm } from "@/components/booking-form";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({ searchParams }: { searchParams: { patientId?: string } }) {
  const [patients, treatments, doctors] = await Promise.all([
    prisma.patient.findMany({ orderBy: { firstName: "asc" } }),
    prisma.treatmentType.findMany({ include: { doctors: { where: { active: true }, select: { id: true } } }, orderBy: { name: "asc" } }),
    prisma.doctor.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="New appointment" subtitle="Pick a treatment and date to see who's free." />
      <BookingForm
        today={todayString()}
        defaultPatientId={searchParams.patientId}
        patients={patients.map((p) => ({ id: p.id, name: fullName(p), phone: p.phone }))}
        treatments={treatments.map((t) => ({ id: t.id, name: t.name, durationMinutes: t.durationMinutes, doctorIds: t.doctors.map((d) => d.id) }))}
        doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}

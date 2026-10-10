import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  const patient = await prisma.patient.findUnique({ where: { id: params.id } });
  if (!patient) notFound();
  return (
    <>
      <PageHeader title={`Edit ${fullName(patient)}`} />
      <PatientForm patient={patient} />
    </>
  );
}

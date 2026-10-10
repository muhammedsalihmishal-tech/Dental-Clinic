import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { DoctorForm } from "@/components/doctor-form";

export const dynamic = "force-dynamic";

export default async function NewDoctorPage() {
  const treatments = await prisma.treatmentType.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add doctor" subtitle="After saving, set their weekly hours." />
      <Card><DoctorForm treatments={treatments} /></Card>
    </>
  );
}

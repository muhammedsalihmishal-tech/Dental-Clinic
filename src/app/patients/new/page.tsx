import { PageHeader } from "@/components/ui";
import { PatientForm } from "@/components/patient-form";

export default function NewPatientPage() {
  return (
    <>
      <PageHeader title="New patient" subtitle="Add a patient to start tracking their visits and follow-ups." />
      <PatientForm />
    </>
  );
}

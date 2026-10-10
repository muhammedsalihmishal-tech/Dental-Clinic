import type { Doctor, TreatmentType } from "@prisma/client";
import { saveDoctor } from "@/app/actions";
import { Field } from "./ui";

export function DoctorForm({ doctor, treatments }: { doctor?: Doctor & { treatments: { id: string }[] }; treatments: TreatmentType[] }) {
  const has = new Set(doctor?.treatments.map((t) => t.id));
  return (
    <form action={saveDoctor} className="space-y-4 p-5">
      {doctor && <input type="hidden" name="id" value={doctor.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" required defaultValue={doctor?.name ?? "Dr. "} className="input" /></Field>
        <Field label="Specialty"><input name="specialty" required defaultValue={doctor?.specialty} className="input" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={doctor?.email ?? ""} className="input" /></Field>
        <Field label="Phone"><input name="phone" defaultValue={doctor?.phone ?? ""} className="input" /></Field>
        <Field label="Calendar colour"><input name="color" type="color" defaultValue={doctor?.color ?? "#14b8a6"} className="input h-10 p-1" /></Field>
        {doctor && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={doctor.active} className="h-4 w-4 accent-teal-600" /> Accepting bookings
          </label>
        )}
      </div>
      <div>
        <span className="label">Treatments this doctor performs</span>
        <div className="flex flex-wrap gap-2">
          {treatments.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="checkbox" name="treatments" value={t.id} defaultChecked={has.has(t.id)} className="accent-teal-600" />
              {t.name}
            </label>
          ))}
        </div>
      </div>
      <button className="btn-primary">{doctor ? "Save profile" : "Create doctor"}</button>
    </form>
  );
}

"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { Patient } from "@prisma/client";
import { savePatient } from "@/app/actions";
import { Field } from "./ui";

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save changes" : "Create patient"}
    </button>
  );
}

export function PatientForm({ patient }: { patient?: Patient }) {
  const [state, action] = useFormState(savePatient, undefined);
  const p = patient;
  return (
    <form action={action} className="card space-y-6 p-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name *"><input name="firstName" required defaultValue={p?.firstName} className="input" /></Field>
        <Field label="Last name"><input name="lastName" defaultValue={p?.lastName} className="input" /></Field>
        <Field label="Phone (with country code) *"><input name="phone" required defaultValue={p?.phone ?? "+91"} className="input" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={p?.email ?? ""} className="input" /></Field>
        <Field label="Date of birth">
          <input name="dateOfBirth" type="date" defaultValue={p?.dateOfBirth?.toISOString().slice(0, 10)} className="input" />
        </Field>
        <Field label="Gender">
          <select name="gender" defaultValue={p?.gender ?? ""} className="input">
            <option value="">—</option><option>Female</option><option>Male</option><option>Other</option>
          </select>
        </Field>
        <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={p?.address ?? ""} className="input" /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Medical alerts (shown on every appointment)"><input name="medicalAlerts" defaultValue={p?.medicalAlerts ?? ""} placeholder="e.g. Diabetic, blood thinners" className="input" /></Field>
        <Field label="Allergies"><input name="allergies" defaultValue={p?.allergies ?? ""} className="input" /></Field>
        <Field label="Insurance"><input name="insurance" defaultValue={p?.insurance ?? ""} className="input" /></Field>
        <Field label="Tags (comma separated)"><input name="tags" defaultValue={p?.tags.join(", ")} placeholder="VIP, Implant patient" className="input" /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Preferred language">
          <select name="language" defaultValue={p?.language ?? "English"} className="input">
            {["English", "Malayalam", "Hindi", "Tamil", "Arabic"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Preferred channel">
          <select name="preferredChannel" defaultValue={p?.preferredChannel ?? "WHATSAPP"} className="input">
            <option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="CALL">Phone call</option>
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={p?.status ?? "NEW"} className="input">
            <option value="LEAD">Lead</option><option value="NEW">New</option><option value="ACTIVE">Active</option>
            <option value="NEEDS_FOLLOW_UP">Needs follow-up</option><option value="INACTIVE">Inactive</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="optOut" defaultChecked={p?.optOut} className="h-4 w-4 accent-teal-600" />
        Patient opted out of automated messages
      </label>

      {state?.error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
      <div className="flex justify-end"><Submit editing={!!p} /></div>
    </form>
  );
}

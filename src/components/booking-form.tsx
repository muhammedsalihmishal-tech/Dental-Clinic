"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createAppointment } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Field } from "./ui";

type Opt = { id: string; name: string };
type Treatment = Opt & { durationMinutes: number; doctorIds: string[] };
type SlotsResponse = { doctor: { id: string; name: string; color: string }; slots: { start: string; label: string }[] }[];

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={disabled || pending}>
      {pending ? "Booking…" : "Book appointment"}
    </button>
  );
}

export function BookingForm(props: { patients: (Opt & { phone: string })[]; treatments: Treatment[]; doctors: Opt[]; defaultPatientId?: string; today: string }) {
  const [state, action] = useFormState(createAppointment, undefined);
  const [treatmentId, setTreatmentId] = useState(props.treatments[0]?.id ?? "");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(props.today);
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [picked, setPicked] = useState<{ doctorId: string; start: string } | null>(null);

  const treatment = props.treatments.find((t) => t.id === treatmentId);
  const eligibleDoctors = useMemo(() => props.doctors.filter((d) => treatment?.doctorIds.includes(d.id)), [props.doctors, treatment]);

  useEffect(() => {
    if (!treatmentId || !date) return;
    const ctrl = new AbortController();
    setSlots(null);
    setPicked(null);
    const qs = new URLSearchParams({ treatmentTypeId: treatmentId, date, ...(doctorId ? { doctorId } : {}) });
    fetch(`/api/availability?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [treatmentId, doctorId, date]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="card space-y-4 p-6">
        <Field label="Patient">
          <select name="patientId" defaultValue={props.defaultPatientId} className="input" required>
            {props.patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>
            ))}
          </select>
        </Field>
        <Field label="Treatment">
          <select name="treatmentTypeId" value={treatmentId} onChange={(e) => { setTreatmentId(e.target.value); setDoctorId(""); }} className="input">
            {props.treatments.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.durationMinutes} min)</option>
            ))}
          </select>
        </Field>
        <Field label="Doctor">
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="input">
            <option value="">Any available doctor</option>
            {eligibleDoctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={date} min={props.today} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
        <Field label="Notes"><textarea name="notes" rows={3} className="input" placeholder="Reason for visit, symptoms…" /></Field>
        <input type="hidden" name="doctorId" value={picked?.doctorId ?? ""} />
        <input type="hidden" name="start" value={picked?.start ?? ""} />
        {state?.error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
        <Submit disabled={!picked} />
      </div>

      <div className="card p-6 lg:col-span-2">
        <h2 className="mb-1 text-sm font-semibold">Available times</h2>
        <p className="mb-5 text-xs text-muted">Live from each doctor&apos;s working hours, time off and existing bookings.</p>
        {slots === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />)}</div>
        ) : slots.every((s) => s.slots.length === 0) ? (
          <p className="py-10 text-center text-sm text-muted">No free times on this day. Try another date or doctor.</p>
        ) : (
          <div className="space-y-6">
            {slots.filter((s) => s.slots.length > 0).map((s) => (
              <div key={s.doctor.id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.doctor.color }} /> {s.doctor.name}
                  <span className="text-xs text-muted">{s.slots.length} slots</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.slots.map((slot) => {
                    const active = picked?.start === slot.start && picked.doctorId === s.doctor.id;
                    return (
                      <button
                        type="button"
                        key={slot.start}
                        onClick={() => setPicked({ doctorId: s.doctor.id, start: slot.start })}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums transition",
                          active ? "border-brand bg-brand text-white dark:text-slate-900" : "border-border hover:border-brand hover:text-brand",
                        )}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

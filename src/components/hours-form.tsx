"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveWorkingHours } from "@/app/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save schedule"}</button>;
}

/** Two blocks per day so a lunch break is just the gap between them. */
export function HoursForm({ doctorId, hours }: { doctorId: string; hours: { dayOfWeek: number; start: string; end: string }[] }) {
  const [state, action] = useFormState(saveWorkingHours, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="doctorId" value={doctorId} />
      <div className="divide-y divide-border">
        {DAYS.map((day, d) => {
          const blocks = hours.filter((h) => h.dayOfWeek === d);
          return (
            <div key={d} className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-3 sm:grid-cols-[110px_1fr_1fr]">
              <div className="text-sm font-medium">{day}</div>
              {[0, 1].map((n) => (
                <div key={n} className="flex items-center gap-2 max-sm:col-start-2">
                  <input type="time" name={`d${d}-${n}-start`} defaultValue={blocks[n]?.start} className="input py-1.5" aria-label={`${day} block ${n + 1} start`} />
                  <span className="text-muted">–</span>
                  <input type="time" name={`d${d}-${n}-end`} defaultValue={blocks[n]?.end} className="input py-1.5" aria-label={`${day} block ${n + 1} end`} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border p-5">
        <p className="text-xs text-muted">
          Leave a day empty for a day off. The gap between the two blocks is the break. The AI receptionist only offers times inside these hours.
        </p>
        {state?.error && <span className="text-sm text-rose-500">{state.error}</span>}
        {state?.ok && <span className="text-sm text-emerald-500">Saved</span>}
        <Submit />
      </div>
    </form>
  );
}

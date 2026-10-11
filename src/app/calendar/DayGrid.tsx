"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bot, Globe } from "lucide-react";
import { AppointmentBadge } from "@/components/badges";
import { cn, fullName } from "@/lib/utils";
import { dragRescheduleAppointment, updateAppointmentStatus } from "../actions";

const HOUR_PX = 88;

function top(min: number, firstHour: number) {
  return ((min - firstHour * 60) / 60) * HOUR_PX;
}

export type DayDoctor = {
  id: string;
  name: string;
  color: string;
  specialty: string;
  workingHours: { id: string; startMinute: number; endMinute: number }[];
  timeOff: { id: string; reason: string | null }[];
  appointments: {
    id: string;
    startMin: number;
    endMin: number;
    startIso: string;
    status: string;
    source: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    patientAlerts: string | null;
    treatmentName: string;
    treatmentColor: string;
    startLabel: string;
    endLabel: string;
    notes: string | null;
    bufferMinutes: number;
  }[];
};

type Props = {
  doctors: DayDoctor[];
  hours: number[];
  firstHour: number;
};

export function DayGrid({ doctors, hours, firstHour }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ doctorId: string; minute: number } | null>(null);
  const [, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function minuteFromY(doctorId: string, clientY: number): number {
    const el = columnRefs.current[doctorId];
    if (!el) return firstHour * 60;
    const rect = el.getBoundingClientRect();
    const relY = clientY - rect.top;
    const rawMin = firstHour * 60 + (relY / HOUR_PX) * 60;
    // Snap to 15-minute intervals
    return Math.round(rawMin / 15) * 15;
  }

  function handleDrop(e: React.DragEvent, doctorId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("appointment_id");
    const startIsoBase = e.dataTransfer.getData("appointment_date"); // YYYY-MM-DD
    if (!id || !startIsoBase) return;

    const minute = minuteFromY(doctorId, e.clientY);
    const hours_part = String(Math.floor(minute / 60)).padStart(2, "0");
    const mins_part = String(minute % 60).padStart(2, "0");
    const newStartIso = `${startIsoBase}T${hours_part}:${mins_part}:00`;

    setDropTarget(null);
    setDragging(null);
    startTransition(async () => {
      const result = await dragRescheduleAppointment(id, newStartIso);
      if (result.error) setErrors((prev) => ({ ...prev, [id]: result.error! }));
      else setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    });
  }

  return (
    <>
      {doctors.map((d) => (
        <div
          key={d.id}
          ref={(el) => { columnRefs.current[d.id] = el; }}
          className="relative border-l border-border"
          style={{ height: hours.length * HOUR_PX }}
          onDragOver={(e) => {
            e.preventDefault();
            const min = minuteFromY(d.id, e.clientY);
            setDropTarget({ doctorId: d.id, minute: min });
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => handleDrop(e, d.id)}
        >
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: top(h * 60, firstHour) }} />
          ))}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgb(var(--surface-2))_6px,rgb(var(--surface-2))_12px)]" />
          {d.timeOff.length === 0 &&
            d.workingHours.map((w) => (
              <div key={w.id} className="absolute inset-x-0 bg-surface" style={{ top: top(w.startMinute, firstHour), height: top(w.endMinute, firstHour) - top(w.startMinute, firstHour) }} />
            ))}

          {/* Drop indicator */}
          {dropTarget?.doctorId === d.id && dragging && (
            <div
              className="pointer-events-none absolute inset-x-1.5 rounded-xl border-2 border-dashed border-brand/60 bg-brand/10"
              style={{ top: top(dropTarget.minute, firstHour), height: 28 }}
            />
          )}

          {d.appointments.map((a) => (
            <details
              key={a.id}
              className={cn("group absolute inset-x-1.5", dragging === a.id && "opacity-50")}
              style={{ top: top(a.startMin, firstHour) + 1, height: Math.max(top(a.endMin, firstHour) - top(a.startMin, firstHour) - 2, 28) }}
            >
              <summary
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("appointment_id", a.id);
                  e.dataTransfer.setData("appointment_date", a.startIso.slice(0, 10));
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(a.id);
                }}
                onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                className={cn(
                  "h-full cursor-grab active:cursor-grabbing list-none overflow-hidden rounded-xl border-l-4 px-2.5 py-1.5 text-xs shadow-sm transition hover:shadow-md",
                  a.status === "NO_SHOW" && "opacity-60",
                  a.status === "HELD" && "border-dashed",
                )}
                style={{ borderColor: a.treatmentColor, background: `${a.treatmentColor}1f` }}
              >
                <div className="flex items-center gap-1 font-semibold">
                  {a.source === "VOICE_AI" && <Bot className="h-3 w-3 shrink-0" />}
                  {a.source === "ONLINE" && <Globe className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{a.patientName}</span>
                </div>
                <div className="truncate text-muted">{a.startLabel} · {a.treatmentName}</div>
                {errors[a.id] && <div className="truncate text-rose-500">{errors[a.id]}</div>}
              </summary>
              <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-border bg-surface p-3 text-xs shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/patients/${a.patientId}`} className="font-semibold hover:text-brand">{a.patientName}</Link>
                  <AppointmentBadge status={a.status as Parameters<typeof AppointmentBadge>[0]["status"]} />
                </div>
                <div className="text-muted">{a.startLabel} – {a.endLabel} · {a.patientPhone}</div>
                {a.notes && <p className="mt-1">{a.notes}</p>}
                {a.patientAlerts && <p className="mt-1 text-rose-500">⚠ {a.patientAlerts}</p>}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const)
                    .filter((s) => s !== a.status)
                    .map((s) => (
                      <form key={s} action={updateAppointmentStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <button className="btn-ghost btn-sm w-full">
                          {{ CONFIRMED: "Confirm", COMPLETED: "Complete", NO_SHOW: "No-show", CANCELLED: "Cancel" }[s]}
                        </button>
                      </form>
                    ))}
                </div>
                <p className="mt-2 text-xs text-muted/70">Drag to reschedule</p>
              </div>
            </details>
          ))}
        </div>
      ))}
    </>
  );
}

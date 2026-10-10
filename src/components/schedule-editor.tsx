"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveWorkingHours } from "@/app/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8am–8pm display range

type Block = { start: string; end: string }; // "HH:MM"
type Schedule = { [day: number]: Block[] }; // up to 2 blocks per day

function minutesFromHHMM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + (m ?? 0);
}

function blockLeft(t: string): string {
  const m = minutesFromHHMM(t);
  return `${((m - 8 * 60) / (12 * 60)) * 100}%`;
}

function blockWidth(start: string, end: string): string {
  const s = minutesFromHHMM(start);
  const e = minutesFromHHMM(end);
  return `${((e - s) / (12 * 60)) * 100}%`;
}

function defaultSchedule(hours: { dayOfWeek: number; start: string; end: string }[]): Schedule {
  const s: Schedule = {};
  for (const h of hours) {
    if (!s[h.dayOfWeek]) s[h.dayOfWeek] = [];
    s[h.dayOfWeek]!.push({ start: h.start, end: h.end });
  }
  return s;
}

export function ScheduleEditor({ doctorId, hours }: { doctorId: string; hours: { dayOfWeek: number; start: string; end: string }[] }) {
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule(hours));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setBlock(day: number, n: number, field: "start" | "end", val: string) {
    setSchedule((prev) => {
      const blocks = [...(prev[day] ?? [])];
      const block = { ...(blocks[n] ?? { start: "09:00", end: "17:00" }) };
      block[field] = val;
      blocks[n] = block;
      return { ...prev, [day]: blocks };
    });
    setSaved(false);
  }

  function addBlock(day: number) {
    setSchedule((prev) => {
      const existing = prev[day] ?? [];
      if (existing.length >= 2) return prev;
      return { ...prev, [day]: [...existing, { start: "14:00", end: "18:00" }] };
    });
    setSaved(false);
  }

  function removeBlock(day: number, n: number) {
    setSchedule((prev) => {
      const blocks = (prev[day] ?? []).filter((_, i) => i !== n);
      const next = { ...prev };
      if (blocks.length === 0) delete next[day];
      else next[day] = blocks;
      return next;
    });
    setSaved(false);
  }

  function toggleDay(day: number) {
    setSchedule((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = [{ start: "09:00", end: "17:00" }];
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    const fd = new FormData();
    fd.append("doctorId", doctorId);
    for (let day = 0; day < 7; day++) {
      const blocks = schedule[day] ?? [];
      for (let n = 0; n < 2; n++) {
        const b = blocks[n];
        if (b) {
          fd.append(`d${day}-${n}-start`, b.start);
          fd.append(`d${day}-${n}-end`, b.end);
        }
      }
    }
    startTransition(async () => {
      const result = await saveWorkingHours(undefined, fd);
      if (result?.error) setError(result.error);
      else { setSaved(true); setError(null); }
    });
  }

  return (
    <div>
      {/* Visual timeline header */}
      <div className="flex gap-2 px-5 pt-4 pb-2">
        <div className="w-20 shrink-0" />
        <div className="relative flex-1 select-none">
          <div className="flex justify-between text-[10px] text-muted">
            {HOURS.map((h) => <span key={h}>{h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}</span>)}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {DAYS.map((name, day) => {
          const on = !!schedule[day];
          const blocks = schedule[day] ?? [];
          return (
            <div key={day} className="grid grid-cols-[80px_1fr] gap-2 px-5 py-3">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={`text-left text-sm font-medium transition-colors ${on ? "" : "text-muted"}`}
              >
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${on ? "bg-brand" : "bg-muted/40"}`} />
                {name}
              </button>

              <div className="space-y-1.5">
                {/* Timeline bar */}
                <div className="relative h-5 overflow-hidden rounded-full bg-surface-2">
                  {blocks.map((b, n) => (
                    <div
                      key={n}
                      className="absolute top-0 h-full rounded-full bg-brand/30"
                      style={{ left: blockLeft(b.start), width: blockWidth(b.start, b.end) }}
                    />
                  ))}
                </div>

                {/* Block inputs */}
                {on && blocks.map((b, n) => (
                  <div key={n} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="time"
                      value={b.start}
                      onChange={(e) => setBlock(day, n, "start", e.target.value)}
                      className="input py-1 text-xs w-28"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      value={b.end}
                      onChange={(e) => setBlock(day, n, "end", e.target.value)}
                      className="input py-1 text-xs w-28"
                    />
                    <button type="button" onClick={() => removeBlock(day, n)} className="text-muted hover:text-rose-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {n === 0 && blocks.length < 2 && (
                      <button type="button" onClick={() => addBlock(day)} className="text-muted hover:text-brand transition-colors" title="Add break block">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {on && blocks.length === 0 && (
                  <button type="button" onClick={() => addBlock(day)} className="text-xs text-brand hover:underline">
                    + Add hours
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border p-5">
        <p className="text-xs text-muted">Click a day name to toggle it off. Use + to add a lunch-break split.</p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-rose-500">{error}</span>}
          {saved && <span className="text-sm text-emerald-500">Saved</span>}
          <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary">
            {isPending ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

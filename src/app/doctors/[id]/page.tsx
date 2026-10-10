import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDate, minutesToHHMM, todayString } from "@/lib/time";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { DoctorForm } from "@/components/doctor-form";
import { ScheduleEditor } from "@/components/schedule-editor";
import { addTimeOff, deleteTimeOff } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function DoctorPage({ params }: { params: { id: string } }) {
  const [doctor, treatments] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        workingHours: { orderBy: { startMinute: "asc" } },
        treatments: { select: { id: true } },
        timeOff: { where: { end: { gt: new Date() } }, orderBy: { start: "asc" } },
      },
    }),
    prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!doctor) notFound();

  return (
    <>
      <PageHeader title={doctor.name} subtitle={doctor.specialty} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Weekly working hours" className="xl:col-span-3">
          <ScheduleEditor
            doctorId={doctor.id}
            hours={doctor.workingHours.map((h) => ({ dayOfWeek: h.dayOfWeek, start: minutesToHHMM(h.startMinute), end: minutesToHHMM(h.endMinute) }))}
          />
        </Card>
        <div className="space-y-6 xl:col-span-2">
          <Card title="Leave & time off">
            <ul className="divide-y divide-border">
              {doctor.timeOff.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">{t.reason ?? "Time off"}</div>
                    <div className="text-xs text-muted">
                      {fmtDate(t.start)} → {fmtDate(new Date(t.end.getTime() - 1))}
                    </div>
                  </div>
                  <form action={deleteTimeOff}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-muted hover:text-rose-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                  </form>
                </li>
              ))}
              {doctor.timeOff.length === 0 && <Empty>No upcoming leave.</Empty>}
            </ul>
            <form action={addTimeOff} className="grid grid-cols-2 gap-3 border-t border-border p-5">
              <input type="hidden" name="doctorId" value={doctor.id} />
              <Field label="From"><input type="date" name="from" required min={todayString()} className="input" /></Field>
              <Field label="To (inclusive)"><input type="date" name="to" min={todayString()} className="input" /></Field>
              <Field label="Reason" className="col-span-2"><input name="reason" placeholder="Holiday, conference…" className="input" /></Field>
              <button className="btn-ghost col-span-2">Block these days</button>
            </form>
          </Card>
          <Card title="Profile"><DoctorForm doctor={doctor} treatments={treatments} /></Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { addDays, clinicDateAt, fmtDate, minutesToLabel, todayString } from "@/lib/time";
import { Avatar, Badge, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function DoctorsPage() {
  const today = todayString();
  const doctors = await prisma.doctor.findMany({
    include: {
      workingHours: { orderBy: { startMinute: "asc" } },
      treatments: { select: { name: true } },
      timeOff: { where: { end: { gt: new Date() } }, orderBy: { start: "asc" }, take: 1 },
      _count: {
        select: {
          appointments: {
            where: { start: { gte: clinicDateAt(today, 0), lt: clinicDateAt(addDays(today, 1), 0) }, status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Doctors & availability"
        subtitle="Working hours and time off here drive both the calendar and the AI receptionist."
        actions={<Link href="/doctors/new" className="btn-primary"><Plus className="h-4 w-4" /> Add doctor</Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {doctors.map((d) => (
          <Link key={d.id} href={`/doctors/${d.id}`} className="card fade-in block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <Avatar name={d.name.replace(/^Dr\.?\s*/, "")} color={d.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{d.name}</div>
                <div className="truncate text-xs text-muted">{d.specialty}</div>
              </div>
              {!d.active ? <Badge>Inactive</Badge> : <Badge tone="teal">{d._count.appointments} today</Badge>}
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {DAYS.map((day, i) => {
                const blocks = d.workingHours.filter((h) => h.dayOfWeek === i);
                return (
                  <div
                    key={day}
                    title={blocks.map((b) => `${minutesToLabel(b.startMinute)}–${minutesToLabel(b.endMinute)}`).join(", ") || "Off"}
                    className={`rounded-lg py-1.5 text-center text-[11px] font-medium ${blocks.length ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted"}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            {d.timeOff[0] && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                Time off from {fmtDate(d.timeOff[0].start)} · {d.timeOff[0].reason ?? "Leave"}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1">
              {d.treatments.slice(0, 4).map((t) => <Badge key={t.name}>{t.name}</Badge>)}
              {d.treatments.length > 4 && <Badge>+{d.treatments.length - 4}</Badge>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

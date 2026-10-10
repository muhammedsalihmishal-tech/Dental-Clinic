import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Stethoscope } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getClinic } from "@/lib/config";
import { doctorDay, computeFreeSlots } from "@/lib/availability";
import { todayString, fmtTime, addDays } from "@/lib/time";
import { fullName } from "@/lib/utils";
import { bookPublicAppointment } from "@/app/actions";

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function BookingHeader({ clinic }: { clinic: { name: string } }) {
  return (
    <header className="border-b border-border bg-surface px-4 py-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-indigo-500 text-lg text-white shadow-lg shadow-teal-500/20">
          🦷
        </div>
        <div>
          <div className="text-sm font-semibold">{clinic.name}</div>
          <div className="text-xs text-muted">Book an appointment</div>
        </div>
      </div>
    </header>
  );
}

function StepBreadcrumb({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Treatment", "Date & time", "Your details"];
  return (
    <div className="flex items-center gap-2 text-xs text-muted mb-6">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span className={active ? "font-semibold text-brand" : done ? "text-fg" : ""}>
              {done ? <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500 mr-0.5" /> : null}
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function BookPage({
  searchParams,
}: {
  searchParams: { t?: string; d?: string; s?: string; date?: string; err?: string };
}) {
  const clinic = await getClinic();
  const { t: treatmentTypeId, d: doctorId, s: startIso, date } = searchParams;

  // Step 3 — patient info form (treatment + doctor + slot selected)
  if (treatmentTypeId && doctorId && startIso) {
    const [treatment, doctor] = await Promise.all([
      prisma.treatmentType.findUnique({ where: { id: treatmentTypeId } }),
      prisma.doctor.findUnique({ where: { id: doctorId } }),
    ]);
    if (!treatment || !doctor) redirect("/book");
    const start = new Date(startIso);

    return (
      <>
        <BookingHeader clinic={clinic} />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <StepBreadcrumb step={3} />
          <div className="rounded-2xl border border-border bg-surface p-4 mb-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: treatment.color }} />
              <span className="font-medium">{treatment.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Stethoscope className="h-3.5 w-3.5" /> {doctor.name}
            </div>
            <div className="flex items-center gap-2 text-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              {start.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Clock className="h-3.5 w-3.5" /> {fmtTime(start)}
            </div>
          </div>

          <form
            action={async (f: FormData) => {
              "use server";
              const result = await bookPublicAppointment(f);
              if (result.error) {
                redirect(`/book?t=${encodeURIComponent(treatmentTypeId)}&d=${encodeURIComponent(doctorId)}&s=${encodeURIComponent(startIso)}&err=${encodeURIComponent(result.error)}`);
              } else {
                redirect(`/book/success?id=${result.appointmentId}`);
              }
            }}
            className="space-y-4 rounded-2xl border border-border bg-surface p-6"
          >
            <h2 className="text-base font-semibold">Your details</h2>
            <input type="hidden" name="treatmentTypeId" value={treatmentTypeId} />
            <input type="hidden" name="doctorId" value={doctorId} />
            <input type="hidden" name="start" value={startIso} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">First name *</label>
                <input name="firstName" required className="input w-full" placeholder="Jane" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Last name</label>
                <input name="lastName" className="input w-full" placeholder="Smith" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Phone number *</label>
              <input name="phone" type="tel" required className="input w-full" placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email (optional)</label>
              <input name="email" type="email" className="input w-full" placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Notes (optional)</label>
              <textarea name="notes" rows={2} className="input w-full" placeholder="Any special requests or concerns…" />
            </div>
            {searchParams.err && (
              <p className="rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-600">{searchParams.err}</p>
            )}
            <button type="submit" className="btn-primary w-full">Confirm booking</button>
          </form>
          <Link href={`/book?t=${treatmentTypeId}`} className="mt-4 block text-center text-sm text-muted hover:text-fg">
            ← Choose a different time
          </Link>
        </div>
      </>
    );
  }

  // Step 2 — date & slot selection (treatment selected)
  if (treatmentTypeId) {
    const treatment = await prisma.treatmentType.findUnique({
      where: { id: treatmentTypeId },
      include: { doctors: { where: { active: true } } },
    });
    if (!treatment) redirect("/book");

    const today = todayString();
    const selectedDate = date ?? today;

    // Generate next 14 date options
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) dates.push(addDays(today, i));

    // Load available slots for all doctors on the selected date
    const slotsPerDoctor = await Promise.all(
      treatment.doctors.map(async (doc) => {
        const { working, busy } = await doctorDay(prisma, doc.id, selectedDate);
        const slots = computeFreeSlots({
          working,
          busy,
          lengthMinutes: treatment.durationMinutes + treatment.bufferMinutes,
          notBefore: new Date(),
        });
        return { doctor: doc, slots };
      })
    );

    const hasAny = slotsPerDoctor.some((d) => d.slots.length > 0);

    return (
      <>
        <BookingHeader clinic={clinic} />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <StepBreadcrumb step={2} />
          <div className="flex items-center gap-3 mb-6">
            <span className="h-4 w-4 rounded-full" style={{ background: treatment.color }} />
            <h2 className="text-base font-semibold">{treatment.name}</h2>
            <span className="text-xs text-muted">{treatment.durationMinutes} min</span>
            <Link href="/book" className="ml-auto text-xs text-muted hover:text-fg">Change</Link>
          </div>

          {/* Date picker */}
          <div className="mb-6 overflow-x-auto pb-2">
            <div className="flex gap-2" style={{ minWidth: "max-content" }}>
              {dates.map((d) => {
                const dt = new Date(`${d}T12:00:00`);
                const isSelected = d === selectedDate;
                return (
                  <Link
                    key={d}
                    href={`/book?t=${treatmentTypeId}&date=${d}`}
                    className={`flex min-w-[52px] flex-col items-center rounded-xl px-3 py-2 text-xs transition ${isSelected ? "bg-brand text-white" : "border border-border hover:bg-surface-2"}`}
                  >
                    <span>{dt.toLocaleDateString("en", { weekday: "short" })}</span>
                    <span className="mt-0.5 text-base font-semibold">{dt.getDate()}</span>
                    <span>{dt.toLocaleDateString("en", { month: "short" })}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Slots */}
          {!hasAny ? (
            <p className="text-center text-sm text-muted py-8">No availability on this day. Try another date.</p>
          ) : (
            <div className="space-y-6">
              {slotsPerDoctor.filter((d) => d.slots.length > 0).map(({ doctor, slots }) => (
                <div key={doctor.id}>
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: doctor.color }} />
                    {doctor.name}
                    <span className="text-xs text-muted font-normal">· {doctor.specialty}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Link
                        key={slot.toISOString()}
                        href={`/book?t=${treatmentTypeId}&d=${doctor.id}&s=${encodeURIComponent(slot.toISOString())}`}
                        className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-brand hover:text-white hover:border-brand transition"
                      >
                        {fmtTime(slot)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  // Step 1 — treatment selection
  const treatments = await prisma.treatmentType.findMany({
    orderBy: { name: "asc" },
    include: { doctors: { where: { active: true }, select: { id: true } } },
  });
  const available = treatments.filter((t) => t.doctors.length > 0);

  return (
    <>
      <BookingHeader clinic={clinic} />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <StepBreadcrumb step={1} />
        <h2 className="text-base font-semibold mb-4">What would you like to book?</h2>
        {available.length === 0 ? (
          <p className="text-sm text-muted">No treatments available for online booking. Please call the clinic.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((t) => (
              <Link
                key={t.id}
                href={`/book?t=${t.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-brand transition"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: t.color + "22" }}>
                  <span className="h-4 w-4 rounded-full" style={{ background: t.color }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm group-hover:text-brand">{t.name}</div>
                  <div className="text-xs text-muted mt-0.5">{t.durationMinutes} min · {t.doctors.length} doctor{t.doctors.length !== 1 ? "s" : ""}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted shrink-0" />
              </Link>
            ))}
          </div>
        )}
        {clinic.phone && (
          <p className="mt-8 text-center text-sm text-muted">
            Prefer to call? Reach us at <span className="font-medium text-fg">{clinic.phone}</span>
          </p>
        )}
      </div>
    </>
  );
}

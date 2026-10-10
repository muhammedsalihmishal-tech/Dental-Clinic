"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus, Channel, PatientStatus, ReminderTrigger, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookingError, bookAppointment, rescheduleAppointment, setAppointmentStatus } from "@/lib/booking";
import { processDueReminders, scheduleTreatmentFollowUps } from "@/lib/reminders";
import { sendMessage } from "@/lib/messaging";
import { clinic } from "@/lib/config";
import { clinicDateAt, labelToMinutes } from "@/lib/time";
import { normalizePhone } from "@/lib/utils";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};
const int = (f: FormData, k: string) => Number(str(f, k) ?? 0) || 0;

export type ActionState = { error?: string; ok?: boolean } | undefined;

// ---------- Patients ----------

function patientData(f: FormData) {
  return {
    firstName: str(f, "firstName") ?? "",
    lastName: str(f, "lastName") ?? "",
    phone: normalizePhone(str(f, "phone") ?? ""),
    email: str(f, "email") ?? null,
    dateOfBirth: str(f, "dateOfBirth") ? new Date(`${str(f, "dateOfBirth")}T00:00:00Z`) : null,
    gender: str(f, "gender") ?? null,
    address: str(f, "address") ?? null,
    medicalAlerts: str(f, "medicalAlerts") ?? null,
    allergies: str(f, "allergies") ?? null,
    insurance: str(f, "insurance") ?? null,
    language: str(f, "language") ?? "English",
    preferredChannel: (str(f, "preferredChannel") ?? "WHATSAPP") as Channel,
    status: (str(f, "status") ?? "NEW") as PatientStatus,
    tags: (str(f, "tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    optOut: f.get("optOut") === "on",
  };
}

export async function savePatient(_: ActionState, f: FormData): Promise<ActionState> {
  const id = str(f, "id");
  const data = patientData(f);
  if (!data.firstName || data.phone.replace(/\D/g, "").length < 6) return { error: "First name and a valid phone are required." };
  const clash = await prisma.patient.findUnique({ where: { phone: data.phone } });
  if (clash && clash.id !== id) return { error: `This phone already belongs to ${clash.firstName} ${clash.lastName}.` };
  const patient = id ? await prisma.patient.update({ where: { id }, data }) : await prisma.patient.create({ data });
  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function addNote(f: FormData) {
  const patientId = str(f, "patientId")!;
  const body = str(f, "body");
  if (!body) return;
  await prisma.note.create({ data: { patientId, body, author: "Staff" } });
  revalidatePath(`/patients/${patientId}`);
}

export async function recordTreatment(f: FormData) {
  const patientId = str(f, "patientId")!;
  const treatmentTypeId = str(f, "treatmentTypeId")!;
  const treatment = await prisma.treatmentType.findUniqueOrThrow({ where: { id: treatmentTypeId } });
  const status = (str(f, "status") ?? "COMPLETED") as "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  const record = await prisma.treatmentRecord.create({
    data: {
      patientId,
      treatmentTypeId,
      doctorId: str(f, "doctorId")!,
      status,
      performedAt: str(f, "performedAt") ? new Date(`${str(f, "performedAt")}T12:00:00Z`) : new Date(),
      teeth: str(f, "teeth"),
      notes: str(f, "notes"),
      cost: str(f, "cost") ? int(f, "cost") : treatment.price,
    },
  });
  if (status === "COMPLETED") await scheduleTreatmentFollowUps(record);
  revalidatePath(`/patients/${patientId}`);
}

// ---------- Appointments ----------

export async function createAppointment(_: ActionState, f: FormData): Promise<ActionState> {
  const start = str(f, "start");
  const patientId = str(f, "patientId");
  const doctorId = str(f, "doctorId");
  const treatmentTypeId = str(f, "treatmentTypeId");
  if (!start || !patientId || !doctorId || !treatmentTypeId) return { error: "Pick a patient, treatment and time slot." };
  try {
    await bookAppointment({ patientId, doctorId, treatmentTypeId, start: new Date(start), notes: str(f, "notes"), source: "STAFF" });
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/calendar");
  redirect(`/patients/${patientId}`);
}

export async function updateAppointmentStatus(f: FormData) {
  const id = str(f, "id")!;
  await setAppointmentStatus(id, str(f, "status") as AppointmentStatus);
  revalidatePath("/", "layout");
}

/** Drag-and-drop reschedule: called from the calendar day view client component. */
export async function dragRescheduleAppointment(id: string, newStartIso: string): Promise<{ error?: string }> {
  try {
    await rescheduleAppointment(id, new Date(newStartIso));
    revalidatePath("/calendar");
    return {};
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    return { error: "Failed to reschedule." };
  }
}

// ---------- Treatment types ----------

export async function saveTreatmentType(f: FormData) {
  const id = str(f, "id");
  const data = {
    name: str(f, "name") ?? "Treatment",
    durationMinutes: int(f, "durationMinutes") || 30,
    bufferMinutes: int(f, "bufferMinutes"),
    price: int(f, "price"),
    color: str(f, "color") ?? "#6366f1",
    reviewLink: str(f, "reviewLink") ?? null,
  };
  if (id) {
    await prisma.treatmentType.update({ where: { id }, data });
  } else {
    await prisma.treatmentType.create({ data });
  }
  revalidatePath("/settings/treatments");
  revalidatePath("/", "layout");
}

export async function deleteTreatmentType(f: FormData) {
  const id = str(f, "id")!;
  await prisma.treatmentType.delete({ where: { id } }).catch(() => null);
  revalidatePath("/settings/treatments");
}

// ---------- Doctors ----------

export async function saveDoctor(f: FormData) {
  const id = str(f, "id");
  const data = {
    name: str(f, "name") ?? "New doctor",
    specialty: str(f, "specialty") ?? "General Dentistry",
    email: str(f, "email") ?? null,
    phone: str(f, "phone") ?? null,
    color: str(f, "color") ?? "#14b8a6",
    active: id ? f.get("active") === "on" : true,
    treatments: { set: f.getAll("treatments").map((t) => ({ id: String(t) })) },
  };
  const doctor = id
    ? await prisma.doctor.update({ where: { id }, data })
    : await prisma.doctor.create({ data: { ...data, treatments: { connect: data.treatments.set } } });
  revalidatePath("/doctors");
  redirect(`/doctors/${doctor.id}`);
}

/** Replace the weekly schedule. Fields are named `d{day}-{n}-start` / `d{day}-{n}-end` (HH:MM). */
export async function saveWorkingHours(_: ActionState, f: FormData): Promise<ActionState> {
  const doctorId = str(f, "doctorId")!;
  const blocks: { doctorId: string; dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let n = 0; n < 2; n++) {
      const s = str(f, `d${day}-${n}-start`);
      const e = str(f, `d${day}-${n}-end`);
      if (!s && !e) continue;
      if (!s || !e) return { error: "Each block needs both a start and an end time." };
      const startMinute = labelToMinutes(s);
      const endMinute = labelToMinutes(e);
      if (endMinute <= startMinute) return { error: "A block's end time must be after its start time." };
      blocks.push({ doctorId, dayOfWeek: day, startMinute, endMinute });
    }
  }
  for (let day = 0; day < 7; day++) {
    const [a, b] = blocks.filter((x) => x.dayOfWeek === day).sort((x, y) => x.startMinute - y.startMinute);
    if (a && b && b.startMinute < a.endMinute) return { error: "Two blocks on the same day overlap." };
  }
  await prisma.$transaction([prisma.workingHours.deleteMany({ where: { doctorId } }), prisma.workingHours.createMany({ data: blocks })]);
  revalidatePath(`/doctors/${doctorId}`);
  return { ok: true };
}

export async function addTimeOff(f: FormData) {
  const doctorId = str(f, "doctorId")!;
  const from = str(f, "from");
  const to = str(f, "to") ?? from;
  if (!from || !to || to < from) return;
  // Whole days, clinic time: from 00:00 on `from` until 24:00 on `to`.
  await prisma.timeOff.create({
    data: { doctorId, start: clinicDateAt(from, 0), end: clinicDateAt(to, 24 * 60), reason: str(f, "reason") },
  });
  revalidatePath(`/doctors/${doctorId}`);
}

export async function deleteTimeOff(f: FormData) {
  const t = await prisma.timeOff.delete({ where: { id: str(f, "id")! } });
  revalidatePath(`/doctors/${t.doctorId}`);
}

// ---------- Follow-up rules ----------

export async function createRule(f: FormData) {
  await prisma.reminderRule.create({
    data: {
      name: str(f, "name") ?? "Untitled rule",
      trigger: str(f, "trigger") as ReminderTrigger,
      treatmentTypeId: str(f, "treatmentTypeId") ?? null,
      offsetDays: int(f, "offsetDays"),
      offsetHours: int(f, "offsetHours"),
      channel: (str(f, "channel") ?? "WHATSAPP") as Channel,
      template: str(f, "template") ?? "",
    },
  });
  revalidatePath("/reminders");
}

export async function toggleRule(f: FormData) {
  const id = str(f, "id")!;
  const rule = await prisma.reminderRule.findUniqueOrThrow({ where: { id } });
  await prisma.reminderRule.update({ where: { id }, data: { active: !rule.active } });
  revalidatePath("/reminders");
}

export async function deleteRule(f: FormData) {
  const id = str(f, "id")!;
  await prisma.reminder.updateMany({ where: { ruleId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  await prisma.reminderRule.delete({ where: { id } });
  revalidatePath("/reminders");
}

export async function runRemindersNow() {
  await processDueReminders();
  revalidatePath("/reminders");
}

export async function cancelReminder(f: FormData) {
  await prisma.reminder.update({ where: { id: str(f, "id")! }, data: { status: "CANCELLED" } });
  revalidatePath("/reminders");
}

/** Send a "we miss you" message to patients inactive for 12+ months. */
export async function runReactivationCampaign(): Promise<{ sent: number; skipped: number }> {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const patients = await prisma.patient.findMany({
    where: { status: "INACTIVE", optOut: false },
    include: {
      records: {
        where: { performedAt: { gte: cutoff } },
        select: { id: true },
        take: 1,
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const p of patients) {
    if (p.records.length > 0) { skipped++; continue; }
    const body = `Hi ${p.firstName}, it's been a while since we last saw you at ${clinic.name}! We'd love to catch up and make sure your smile is in great shape. Give us a call at ${clinic.phone} to book your next visit. – ${clinic.name}`;
    const result = await sendMessage(p.preferredChannel as "SMS" | "WHATSAPP", p.phone, body).catch(() => ({ ok: false }));
    if (result.ok) sent++; else skipped++;
  }

  revalidatePath("/reminders");
  return { sent, skipped };
}

// ---------- Tasks ----------

export async function createTask(f: FormData) {
  const title = str(f, "title");
  if (!title) return;
  await prisma.task.create({
    data: { title, patientId: str(f, "patientId"), priority: (str(f, "priority") ?? "NORMAL") as TaskPriority, dueAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function completeTask(f: FormData) {
  await prisma.task.update({ where: { id: str(f, "id")! }, data: { done: true } });
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus, Channel, InvoiceStatus, LabOrderStatus, PatientStatus, ReminderTrigger, TaskPriority, TreatmentPlanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BookingError, bookAppointment, rescheduleAppointment, setAppointmentStatus } from "@/lib/booking";
import { processDueReminders, scheduleTreatmentFollowUps } from "@/lib/reminders";
import { sendMessage } from "@/lib/messaging";
import { getClinic } from "@/lib/config";
import { clinicDateAt, fmtTime, labelToMinutes } from "@/lib/time";
import { manageBookingUrl } from "@/lib/tokens";
import { formatMoney, normalizePhone } from "@/lib/utils";

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
  const recallMonthsRaw = int(f, "recallMonths");
  const data = {
    name: str(f, "name") ?? "Treatment",
    durationMinutes: int(f, "durationMinutes") || 30,
    bufferMinutes: int(f, "bufferMinutes"),
    price: int(f, "price"),
    color: str(f, "color") ?? "#6366f1",
    reviewLink: str(f, "reviewLink") ?? null,
    recallMonths: recallMonthsRaw > 0 ? recallMonthsRaw : null,
  };
  if (id) {
    await prisma.treatmentType.update({ where: { id }, data });
  } else {
    await prisma.treatmentType.create({ data });
  }
  revalidatePath("/settings/treatments");
  revalidatePath("/recall");
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

  const c = await getClinic();
  for (const p of patients) {
    if (p.records.length > 0) { skipped++; continue; }
    const body = `Hi ${p.firstName}, it's been a while since we last saw you at ${c.name}! We'd love to catch up and make sure your smile is in great shape. Give us a call at ${c.phone} to book your next visit. – ${c.name}`;
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

export async function deleteTask(f: FormData) {
  await prisma.task.delete({ where: { id: str(f, "id")! } });
  revalidatePath("/", "layout");
}

// ---------- Invoices ----------

async function nextInvoiceNumber(): Promise<string> {
  const last = await prisma.invoice.findFirst({ orderBy: { createdAt: "desc" }, select: { number: true } });
  const n = last ? parseInt(last.number.replace(/\D/g, ""), 10) + 1 : 1;
  return `INV-${String(n).padStart(4, "0")}`;
}

export async function createInvoice(f: FormData) {
  const treatmentRecordId = str(f, "treatmentRecordId");
  const patientId = str(f, "patientId")!;
  const amount = int(f, "amount");
  const number = await nextInvoiceNumber();
  await prisma.invoice.create({
    data: {
      number,
      patientId,
      treatmentRecordId: treatmentRecordId ?? null,
      amount,
      notes: str(f, "notes") ?? null,
      status: "DRAFT",
    },
  });
  revalidatePath("/invoices");
  revalidatePath(`/patients/${patientId}`);
}

export async function updateInvoiceStatus(f: FormData) {
  const id = str(f, "id")!;
  const status = str(f, "status") as InvoiceStatus;
  await prisma.invoice.update({
    where: { id },
    data: { status, paidAt: status === "PAID" ? new Date() : undefined },
  });
  revalidatePath("/invoices");
}

export async function sendInvoiceMessage(f: FormData) {
  const id = str(f, "id")!;
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id },
    include: { patient: true, treatmentRecord: { include: { treatmentType: true, doctor: true } } },
  });
  const c = await getClinic();
  const treatmentLine = inv.treatmentRecord
    ? `${inv.treatmentRecord.treatmentType.name} with ${inv.treatmentRecord.doctor.name}`
    : "your recent visit";
  const body = `Hi ${inv.patient.firstName}, your invoice ${inv.number} for ${treatmentLine} is ₹${formatMoney(inv.amount)} (${inv.status}). For queries call ${c.phone}. – ${c.name}`;
  await sendMessage(inv.patient.preferredChannel as "SMS" | "WHATSAPP", inv.patient.phone, body);
  await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
  revalidatePath("/invoices");
}

// ---------- Inbound inbox ----------

export async function markInboundHandled(f: FormData) {
  await prisma.inboundMessage.update({ where: { id: str(f, "id")! }, data: { handled: true } });
  revalidatePath("/inbox");
}

export async function markAllInboundHandled() {
  await prisma.inboundMessage.updateMany({ where: { handled: false }, data: { handled: true } });
  revalidatePath("/inbox");
}

// ---------- Reminder rules (settings page) ----------

export async function saveReminderRule(f: FormData) {
  const id = str(f, "id");
  const data = {
    name: str(f, "name") ?? "Untitled",
    trigger: str(f, "trigger") as ReminderTrigger,
    treatmentTypeId: str(f, "treatmentTypeId") ?? null,
    offsetDays: int(f, "offsetDays"),
    offsetHours: int(f, "offsetHours"),
    channel: (str(f, "channel") ?? "WHATSAPP") as Channel,
    template: str(f, "template") ?? "",
    active: f.get("active") !== "false",
  };
  if (id) await prisma.reminderRule.update({ where: { id }, data });
  else await prisma.reminderRule.create({ data });
  revalidatePath("/settings/reminders");
  revalidatePath("/reminders");
}

export async function deleteReminderRule(f: FormData) {
  const id = str(f, "id")!;
  await prisma.reminder.updateMany({ where: { ruleId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
  await prisma.reminderRule.delete({ where: { id } });
  revalidatePath("/settings/reminders");
  revalidatePath("/reminders");
}

// ---------- Treatment plans ----------

export async function createTreatmentPlan(f: FormData) {
  const patientId = str(f, "patientId")!;
  await prisma.treatmentPlan.create({
    data: {
      patientId,
      title: str(f, "title") ?? "New plan",
      notes: str(f, "notes") ?? null,
    },
  });
  revalidatePath("/plans");
  revalidatePath(`/patients/${patientId}`);
}

export async function updateTreatmentPlan(f: FormData) {
  const id = str(f, "id")!;
  const plan = await prisma.treatmentPlan.update({
    where: { id },
    data: {
      title: str(f, "title") ?? undefined,
      notes: str(f, "notes") ?? null,
      status: (str(f, "status") as TreatmentPlanStatus) ?? undefined,
    },
  });
  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
  revalidatePath(`/patients/${plan.patientId}`);
}

export async function assignRecordToPlan(f: FormData) {
  const planId = str(f, "planId")!;
  const recordId = str(f, "recordId")!;
  await prisma.treatmentRecord.update({ where: { id: recordId }, data: { planId } });
  revalidatePath(`/plans/${planId}`);
}

// ---------- Recall ----------

export async function sendRecallSms(f: FormData) {
  const patientId = str(f, "patientId")!;
  const treatmentTypeId = str(f, "treatmentTypeId");
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: patientId } });
  if (patient.optOut) return;

  if (treatmentTypeId) {
    const recent = await prisma.recallLog.findFirst({
      where: { patientId, treatmentTypeId, sentAt: { gt: new Date(Date.now() - 30 * 86400000) } },
    });
    if (recent) return;
  }

  const [c, treatment] = await Promise.all([
    getClinic(),
    treatmentTypeId ? prisma.treatmentType.findUnique({ where: { id: treatmentTypeId } }) : null,
  ]);
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const bookUrl = treatmentTypeId ? `${base}/book?t=${treatmentTypeId}` : `${base}/book`;
  const treatmentName = treatment?.name ?? "check-up";
  const body = `Hi ${patient.firstName}, you're due for your ${treatmentName} at ${c.name}. Book online: ${bookUrl} or call ${c.phone}. – ${c.name}`;
  await sendMessage(patient.preferredChannel as "SMS" | "WHATSAPP", patient.phone, body).catch(() => null);

  if (treatmentTypeId) {
    await prisma.recallLog.create({ data: { patientId, treatmentTypeId } });
  }
  revalidatePath("/recall");
}

export async function sendAllRecalls(f: FormData) {
  const treatmentTypeId = str(f, "treatmentTypeId")!;
  const patientIds = f.getAll("patientId").map(String).filter(Boolean);
  for (const patientId of patientIds) {
    const fd = new FormData();
    fd.append("patientId", patientId);
    fd.append("treatmentTypeId", treatmentTypeId);
    await sendRecallSms(fd);
  }
  revalidatePath("/recall");
}

// ---------- Campaigns ----------

export async function createCampaign(f: FormData) {
  const statuses = f.getAll("statuses").map(String).filter(Boolean);
  const tags = (str(f, "tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const lastSeenBeforeDays = int(f, "lastSeenBeforeDays") || undefined;
  await prisma.campaign.create({
    data: {
      name: str(f, "name") ?? "Campaign",
      message: str(f, "message") ?? "",
      channel: (str(f, "channel") ?? "WHATSAPP") as Channel,
      segment: { statuses: statuses.length ? statuses : undefined, tags: tags.length ? tags : undefined, lastSeenBeforeDays },
    },
  });
  revalidatePath("/campaigns");
}

export async function sendCampaign(f: FormData) {
  const id = str(f, "id")!;
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  if (campaign.status !== "DRAFT") return;

  const seg = campaign.segment as { statuses?: string[]; tags?: string[]; lastSeenBeforeDays?: number };
  const where: Record<string, unknown> = { optOut: false };
  if (seg.statuses?.length) where.status = { in: seg.statuses };
  if (seg.tags?.length) where.tags = { hasSome: seg.tags };

  const patients = await prisma.patient.findMany({
    where,
    select: { id: true, firstName: true, phone: true, preferredChannel: true },
  });

  let filtered = patients;
  if (seg.lastSeenBeforeDays) {
    const cutoff = new Date(Date.now() - seg.lastSeenBeforeDays * 86400000);
    const recentIds = await prisma.appointment.findMany({
      where: { patientId: { in: patients.map((p) => p.id) }, start: { gte: cutoff }, status: "COMPLETED" },
      select: { patientId: true },
      distinct: ["patientId"],
    });
    const recentSet = new Set(recentIds.map((a) => a.patientId));
    filtered = patients.filter((p) => !recentSet.has(p.id));
  }

  await prisma.campaign.update({ where: { id }, data: { status: "SENDING" } });

  const c = await getClinic();
  let sent = 0, fail = 0;
  for (const p of filtered) {
    const body = campaign.message
      .replace(/\{\{name\}\}/g, p.firstName)
      .replace(/\{\{clinic\}\}/g, c.name)
      .replace(/\{\{phone\}\}/g, c.phone);
    const result = await sendMessage(p.preferredChannel as "SMS" | "WHATSAPP", p.phone, body).catch(() => ({ ok: false }));
    await prisma.campaignMessage.create({ data: { campaignId: id, patientId: p.id, sent: (result as { ok: boolean }).ok, error: (result as { ok: boolean }).ok ? null : "Failed" } });
    if ((result as { ok: boolean }).ok) sent++; else fail++;
  }

  await prisma.campaign.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), sentCount: sent, failCount: fail } });
  revalidatePath("/campaigns");
}

// ---------- Lab orders ----------

export async function createLabOrder(f: FormData) {
  const patientId = str(f, "patientId")!;
  await prisma.labOrder.create({
    data: {
      patientId,
      treatmentRecordId: str(f, "treatmentRecordId") ?? null,
      labName: str(f, "labName") ?? "Lab",
      material: str(f, "material") ?? null,
      shade: str(f, "shade") ?? null,
      dueAt: str(f, "dueAt") ? new Date(`${str(f, "dueAt")}T12:00:00Z`) : null,
      notes: str(f, "notes") ?? null,
    },
  });
  revalidatePath("/lab");
  revalidatePath(`/patients/${patientId}`);
}

export async function updateLabOrderStatus(f: FormData) {
  const id = str(f, "id")!;
  const status = str(f, "status") as LabOrderStatus;
  await prisma.labOrder.update({
    where: { id },
    data: { status, receivedAt: status === "RECEIVED" ? new Date() : undefined },
  });
  revalidatePath("/lab");
}

// ---------- Public online booking ----------

export async function bookPublicAppointment(f: FormData): Promise<{ error?: string; appointmentId?: string }> {
  const treatmentTypeId = str(f, "treatmentTypeId");
  const doctorId = str(f, "doctorId");
  const startIso = str(f, "start");
  const firstName = str(f, "firstName");
  const lastName = str(f, "lastName") ?? "";
  const phone = normalizePhone(str(f, "phone") ?? "");
  const email = str(f, "email");

  if (!treatmentTypeId || !doctorId || !startIso || !firstName || !phone) {
    return { error: "Please fill in all required fields." };
  }
  if (phone.replace(/\D/g, "").length < 6) return { error: "Please enter a valid phone number." };

  const start = new Date(startIso);

  // Find or create patient
  let patient = await prisma.patient.findUnique({ where: { phone } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: { firstName, lastName, phone, email: email ?? null, status: "NEW" },
    });
  }

  try {
    const appt = await bookAppointment({
      patientId: patient.id,
      doctorId,
      treatmentTypeId,
      start,
      source: "ONLINE",
      notes: str(f, "notes"),
    });

    // Send confirmation with manage link (fire-and-forget)
    Promise.all([
      prisma.treatmentType.findUnique({ where: { id: treatmentTypeId } }),
      prisma.doctor.findUnique({ where: { id: doctorId } }),
      getClinic(),
    ]).then(([treatment, doctor, c]) => {
      if (!treatment || !doctor) return;
      const manageUrl = manageBookingUrl(appt.id);
      const msg = `Hi ${patient.firstName}, your ${treatment.name} with ${doctor.name} on ${appt.start.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })} at ${fmtTime(appt.start)} is confirmed at ${c.name}. Manage: ${manageUrl}`;
      return sendMessage(patient.preferredChannel, patient.phone, msg);
    }).catch(() => null);

    return { appointmentId: appt.id };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    return { error: "This slot is no longer available. Please choose another time." };
  }
}

import { z } from "zod";
import { prisma } from "./prisma";
import { clinic, HOLD_MINUTES } from "./config";
import { getAvailability } from "./availability";
import { BookingError, bookAppointment, cancelAppointment, confirmHold, rescheduleAppointment } from "./booking";
import { addDays, clinicMinuteOfDay, fmtDate, fmtDateTime, fmtTime, minutesToLabel, todayString } from "./time";
import { fullName, normalizePhone } from "./utils";

/**
 * Tools the voice agent (Vapi, Retell, ...) can call during a phone conversation.
 * Every result is short and speakable so the agent can read it back naturally.
 */

const dateArg = z
  .string()
  .describe('Date as YYYY-MM-DD, or "today" / "tomorrow"')
  .transform((v) => {
    const s = v.trim().toLowerCase();
    if (s === "today") return todayString();
    if (s === "tomorrow") return addDays(todayString(), 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Date must be YYYY-MM-DD");
    return s;
  });

const isoStart = z
  .string()
  .describe("Exact appointment start as returned by check_availability (ISO 8601)")
  .transform((v, ctx) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid start time" });
    return d;
  });

async function resolveTreatment(name: string) {
  const t = await prisma.treatmentType.findFirst({ where: { name: { contains: name.trim(), mode: "insensitive" } } });
  if (t) return t;
  const all = await prisma.treatmentType.findMany({ select: { name: true } });
  throw new BookingError(`I couldn't find "${name}". Treatments we offer: ${all.map((a) => a.name).join(", ")}.`);
}

async function resolveDoctor(name: string) {
  const cleaned = name.replace(/^dr\.?\s*/i, "").trim();
  const d = await prisma.doctor.findFirst({ where: { active: true, name: { contains: cleaned, mode: "insensitive" } } });
  if (!d) throw new BookingError(`I couldn't find a doctor named "${name}".`);
  return d;
}

async function findPatientByPhone(raw: string) {
  const phone = normalizePhone(raw);
  const last10 = phone.replace(/\D/g, "").slice(-10);
  return prisma.patient.findFirst({
    where: { OR: [{ phone }, ...(last10.length === 10 ? [{ phone: { endsWith: last10 } }] : [])] },
  });
}

const TIME_OF_DAY = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] } as const;

type ToolDef<S extends z.ZodTypeAny> = {
  description: string;
  parameters: S;
  run: (args: z.output<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodTypeAny>(def: ToolDef<S>) => def;

export const voiceTools = {
  get_clinic_info: tool({
    description: "Clinic name, address, phone, opening hours and the treatments offered with prices and durations.",
    parameters: z.object({}),
    run: async () => {
      const [treatments, hours] = await Promise.all([
        prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
        prisma.workingHours.findMany({ where: { doctor: { active: true } } }),
      ]);
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const openingHours = days
        .map((day, i) => {
          const blocks = hours.filter((h) => h.dayOfWeek === i);
          if (blocks.length === 0) return `${day}: closed`;
          const open = Math.min(...blocks.map((b) => b.startMinute));
          const close = Math.max(...blocks.map((b) => b.endMinute));
          return `${day}: ${minutesToLabel(open)} to ${minutesToLabel(close)}`;
        })
        .join("; ");
      return {
        name: clinic.name,
        address: clinic.address,
        phone: clinic.phone,
        openingHours,
        treatments: treatments.map((t) => ({ name: t.name, minutes: t.durationMinutes, priceINR: t.price })),
      };
    },
  }),

  find_patient: tool({
    description: "Look up an existing patient by phone number (preferred, use the caller ID) or by name.",
    parameters: z.object({ phone: z.string().optional(), name: z.string().optional() }),
    run: async ({ phone, name }) => {
      let patients = phone ? [await findPatientByPhone(phone)].filter((p) => p !== null) : [];
      if (patients.length === 0 && name) {
        const parts = name.trim().split(/\s+/);
        patients = await prisma.patient.findMany({
          where: {
            AND: parts.map((p) => ({
              OR: [{ firstName: { contains: p, mode: "insensitive" as const } }, { lastName: { contains: p, mode: "insensitive" as const } }],
            })),
          },
          take: 3,
        });
      }
      if (patients.length === 0) return { found: false };
      const now = new Date();
      return {
        found: true,
        patients: await Promise.all(
          patients.map(async (p) => {
            const [next, last] = await Promise.all([
              prisma.appointment.findFirst({
                where: { patientId: p.id, start: { gt: now }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
                include: { doctor: true, treatmentType: true },
                orderBy: { start: "asc" },
              }),
              prisma.treatmentRecord.findFirst({
                where: { patientId: p.id },
                include: { treatmentType: true },
                orderBy: { performedAt: "desc" },
              }),
            ]);
            return {
              patientId: p.id,
              name: fullName(p),
              preferredLanguage: p.language,
              medicalAlerts: p.medicalAlerts ?? undefined,
              nextAppointment: next
                ? { appointmentId: next.id, when: fmtDateTime(next.start), doctor: next.doctor.name, treatment: next.treatmentType.name }
                : undefined,
              lastTreatment: last ? { treatment: last.treatmentType.name, date: fmtDate(last.performedAt) } : undefined,
            };
          }),
        ),
      };
    },
  }),

  create_patient: tool({
    description: "Register a new patient. Only call after confirming the caller is not already a patient.",
    parameters: z.object({
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      phone: z.string().min(5),
      email: z.string().email().optional(),
      language: z.string().optional(),
    }),
    run: async (a) => {
      const existing = await findPatientByPhone(a.phone);
      if (existing) return { patientId: existing.id, name: fullName(existing), alreadyExisted: true };
      const p = await prisma.patient.create({
        data: {
          firstName: a.firstName.trim(),
          lastName: a.lastName?.trim() ?? "",
          phone: normalizePhone(a.phone),
          email: a.email,
          language: a.language ?? "English",
          status: "NEW",
          tags: ["Voice AI"],
        },
      });
      return { patientId: p.id, name: fullName(p), alreadyExisted: false };
    },
  }),

  check_availability: tool({
    description:
      "Find free appointment times for a treatment. Without a date, searches the next 7 days. Offer the caller two or three options, not the whole list.",
    parameters: z.object({
      treatment: z.string().describe("Treatment name, e.g. 'cleaning' or 'root canal'"),
      date: dateArg.optional(),
      doctor: z.string().optional().describe("Doctor name if the caller has a preference"),
      timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
    }),
    run: async ({ treatment, date, doctor, timeOfDay }) => {
      const t = await resolveTreatment(treatment);
      const d = doctor ? await resolveDoctor(doctor) : undefined;
      const dates = date ? [date] : Array.from({ length: 7 }, (_, i) => addDays(todayString(), i));
      const days: { date: string; label: string; options: { start: string; time: string; doctor: string }[] }[] = [];

      for (const day of dates) {
        const perDoctor = await getAvailability({ treatmentTypeId: t.id, date: day, doctorId: d?.id });
        const options = perDoctor
          .flatMap((p) => p.slots.map((s) => ({ s, doctor: p.doctor.name })))
          .filter(({ s }) => {
            if (!timeOfDay) return true;
            const m = clinicMinuteOfDay(s);
            return m >= TIME_OF_DAY[timeOfDay][0] && m < TIME_OF_DAY[timeOfDay][1];
          })
          .sort((a, b) => a.s.getTime() - b.s.getTime());
        // Spread suggestions across the day instead of listing back-to-back 15-minute starts.
        const picked: typeof options = [];
        for (const o of options) {
          if (picked.length >= 6) break;
          const last = picked[picked.length - 1];
          if (!last || o.s.getTime() - last.s.getTime() >= 60 * 60_000 || o.doctor !== last.doctor) picked.push(o);
        }
        if (picked.length > 0) {
          days.push({
            date: day,
            label: fmtDate(picked[0]!.s),
            options: picked.map((o) => ({ start: o.s.toISOString(), time: fmtTime(o.s), doctor: o.doctor })),
          });
        }
        if (!date && days.length >= 2) break;
      }
      return {
        treatment: t.name,
        durationMinutes: t.durationMinutes,
        available: days.length > 0,
        days,
        ...(days.length === 0 ? { message: "No free times in that range. Offer another day, doctor, or the waitlist." } : {}),
      };
    },
  }),

  hold_slot: tool({
    description: `Reserve a time for ${HOLD_MINUTES} minutes while you confirm details with the caller. Then call book_appointment with the holdId.`,
    parameters: z.object({ patientId: z.string(), treatment: z.string(), doctor: z.string(), start: isoStart }),
    run: async ({ patientId, treatment, doctor, start }) => {
      const [t, d] = await Promise.all([resolveTreatment(treatment), resolveDoctor(doctor)]);
      const hold = await bookAppointment({ patientId, doctorId: d.id, treatmentTypeId: t.id, start, source: "VOICE_AI", hold: true });
      return { holdId: hold.id, when: fmtDateTime(hold.start), doctor: d.name, expiresInMinutes: HOLD_MINUTES };
    },
  }),

  book_appointment: tool({
    description: "Book the appointment. Pass holdId if you held the slot; otherwise pass treatment, start and (optionally) doctor.",
    parameters: z.object({
      patientId: z.string(),
      holdId: z.string().optional(),
      treatment: z.string().optional(),
      start: isoStart.optional(),
      doctor: z.string().optional(),
      notes: z.string().optional().describe("Reason for visit or symptoms in the caller's words"),
    }),
    run: async ({ patientId, holdId, treatment, start, doctor, notes }) => {
      let appt;
      if (holdId) {
        appt = await confirmHold(holdId, patientId);
        if (notes) appt = await prisma.appointment.update({ where: { id: appt.id }, data: { notes } });
      } else {
        if (!treatment || !start) throw new BookingError("I need the treatment and the time to book.");
        const t = await resolveTreatment(treatment);
        let doctorIds: string[];
        if (doctor) doctorIds = [(await resolveDoctor(doctor)).id];
        else doctorIds = (await prisma.doctor.findMany({ where: { active: true, treatments: { some: { id: t.id } } } })).map((x) => x.id);
        let lastError: unknown;
        for (const doctorId of doctorIds) {
          try {
            appt = await bookAppointment({ patientId, doctorId, treatmentTypeId: t.id, start, source: "VOICE_AI", notes });
            break;
          } catch (e) {
            lastError = e;
          }
        }
        if (!appt) throw lastError ?? new BookingError("No doctor is free at that time.");
      }
      const full = await prisma.appointment.findUniqueOrThrow({
        where: { id: appt.id },
        include: { doctor: true, treatmentType: true },
      });
      return {
        booked: true,
        appointmentId: full.id,
        when: fmtDateTime(full.start),
        doctor: full.doctor.name,
        treatment: full.treatmentType.name,
        address: clinic.address,
      };
    },
  }),

  get_upcoming_appointments: tool({
    description: "List the patient's upcoming appointments (use before rescheduling or cancelling).",
    parameters: z.object({ patientId: z.string() }),
    run: async ({ patientId }) => {
      const appts = await prisma.appointment.findMany({
        where: { patientId, start: { gt: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
        include: { doctor: true, treatmentType: true },
        orderBy: { start: "asc" },
        take: 5,
      });
      return {
        appointments: appts.map((a) => ({
          appointmentId: a.id,
          when: fmtDateTime(a.start),
          doctor: a.doctor.name,
          treatment: a.treatmentType.name,
        })),
      };
    },
  }),

  reschedule_appointment: tool({
    description: "Move an existing appointment to a new free time (check_availability first).",
    parameters: z.object({ appointmentId: z.string(), start: isoStart, doctor: z.string().optional() }),
    run: async ({ appointmentId, start, doctor }) => {
      const d = doctor ? await resolveDoctor(doctor) : undefined;
      const appt = await rescheduleAppointment(appointmentId, start, d?.id);
      const full = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id }, include: { doctor: true } });
      return { rescheduled: true, when: fmtDateTime(full.start), doctor: full.doctor.name };
    },
  }),

  cancel_appointment: tool({
    description: "Cancel an appointment. Before cancelling, offer to reschedule instead.",
    parameters: z.object({ appointmentId: z.string(), reason: z.string().optional() }),
    run: async ({ appointmentId, reason }) => {
      await cancelAppointment(appointmentId, reason ? `Cancelled by caller: ${reason}` : undefined);
      return { cancelled: true };
    },
  }),

  transfer_to_human: tool({
    description:
      "Hand the call to clinic staff: the caller asks for a person, is upset, or describes an emergency (severe pain, swelling, bleeding, trauma).",
    parameters: z.object({
      reason: z.string(),
      emergency: z.boolean().optional(),
      patientId: z.string().optional(),
      phone: z.string().optional(),
    }),
    run: async ({ reason, emergency, patientId, phone }) => {
      await prisma.task.create({
        data: {
          title: `${emergency ? "EMERGENCY call" : "Call transferred"}${phone ? ` from ${phone}` : ""}: ${reason}`,
          patientId,
          priority: emergency ? "URGENT" : "NORMAL",
          dueAt: new Date(),
        },
      });
      return { transfer: true, transferTo: clinic.phone, staffAlerted: true };
    },
  }),
};

export type VoiceToolName = keyof typeof voiceTools;

export async function runVoiceTool(name: string, rawArgs: unknown): Promise<unknown> {
  const def = (voiceTools as unknown as Record<string, ToolDef<z.ZodTypeAny>>)[name];
  if (!def) return { error: `Unknown tool "${name}"` };
  const parsed = def.parameters.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { error: "Invalid arguments", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  try {
    return await def.run(parsed.data);
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message };
    console.error(`[voice-tool:${name}]`, e);
    return { error: "Something went wrong on our side. Offer to transfer the caller to the front desk." };
  }
}

/** JSON-schema tool definitions to paste into the voice provider (also served by GET /api/voice/tools). */
export function voiceToolDefinitions() {
  return Object.entries(voiceTools).map(([name, def]) => ({
    type: "function" as const,
    function: { name, description: def.description, parameters: zodToJsonSchema(def.parameters) },
  }));
}

/** Minimal Zod → JSON Schema for the flat shapes used above. */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const describe = (s: z.ZodTypeAny) => (s.description ? { description: s.description } : {});
  if (schema instanceof z.ZodEffects) return { ...zodToJsonSchema(schema.innerType()), ...describe(schema) };
  if (schema instanceof z.ZodOptional) return { ...zodToJsonSchema(schema.unwrap()), ...describe(schema) };
  if (schema instanceof z.ZodString) return { type: "string", ...describe(schema) };
  if (schema instanceof z.ZodBoolean) return { type: "boolean", ...describe(schema) };
  if (schema instanceof z.ZodNumber) return { type: "number", ...describe(schema) };
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options, ...describe(schema) };
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    return {
      type: "object",
      properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, zodToJsonSchema(v)])),
      required: Object.entries(shape)
        .filter(([, v]) => !v.isOptional())
        .map(([k]) => k),
    };
  }
  return {};
}

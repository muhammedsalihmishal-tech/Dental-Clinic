import { PrismaClient } from "@prisma/client";
import { addDays, clinicDateAt, todayString } from "../src/lib/time";

const prisma = new PrismaClient();

const h = (hour: number, min = 0) => hour * 60 + min;

async function main() {
  await prisma.$transaction([
    prisma.reminder.deleteMany(),
    prisma.reminderRule.deleteMany(),
    prisma.treatmentRecord.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.callLog.deleteMany(),
    prisma.note.deleteMany(),
    prisma.task.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.timeOff.deleteMany(),
    prisma.workingHours.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.treatmentType.deleteMany(),
  ]);

  const treatments = Object.fromEntries(
    await Promise.all(
      [
        { key: "checkup", name: "Check-up & Consultation", durationMinutes: 30, bufferMinutes: 0, price: 500, color: "#0ea5e9" },
        { key: "cleaning", name: "Scaling & Cleaning", durationMinutes: 45, bufferMinutes: 15, price: 1500, color: "#14b8a6" },
        { key: "filling", name: "Tooth Filling", durationMinutes: 45, bufferMinutes: 15, price: 2000, color: "#8b5cf6" },
        { key: "rootCanal", name: "Root Canal", durationMinutes: 90, bufferMinutes: 15, price: 8000, color: "#f43f5e" },
        { key: "extraction", name: "Tooth Extraction", durationMinutes: 45, bufferMinutes: 15, price: 2500, color: "#f59e0b" },
        { key: "whitening", name: "Teeth Whitening", durationMinutes: 60, bufferMinutes: 0, price: 6000, color: "#eab308" },
        { key: "braces", name: "Braces Adjustment", durationMinutes: 30, bufferMinutes: 0, price: 1200, color: "#6366f1" },
        { key: "implant", name: "Implant Consultation", durationMinutes: 60, bufferMinutes: 0, price: 1000, color: "#10b981" },
      ].map(async ({ key, ...t }) => [key, await prisma.treatmentType.create({ data: t })] as const),
    ),
  );
  const T = treatments as Record<string, { id: string; durationMinutes: number; bufferMinutes: number; price: number }>;

  const weekdays = [1, 2, 3, 4, 5, 6];
  const doctors = [
    {
      name: "Dr. Aisha Rahman",
      specialty: "General Dentistry",
      color: "#14b8a6",
      treatments: ["checkup", "cleaning", "filling", "extraction", "whitening"],
      hours: weekdays.flatMap((d) => [
        { dayOfWeek: d, startMinute: h(9), endMinute: h(13) },
        { dayOfWeek: d, startMinute: h(14), endMinute: h(18) },
      ]),
    },
    {
      name: "Dr. Arjun Menon",
      specialty: "Endodontics & Implants",
      color: "#6366f1",
      treatments: ["checkup", "rootCanal", "extraction", "implant", "filling"],
      hours: [1, 3, 5, 6].flatMap((d) => [
        { dayOfWeek: d, startMinute: h(10), endMinute: h(13, 30) },
        { dayOfWeek: d, startMinute: h(14, 30), endMinute: h(19) },
      ]),
    },
    {
      name: "Dr. Sara Thomas",
      specialty: "Orthodontics",
      color: "#f43f5e",
      treatments: ["checkup", "braces", "whitening", "cleaning"],
      hours: [2, 4, 6].map((d) => ({ dayOfWeek: d, startMinute: h(11), endMinute: h(19) })),
    },
  ];

  const docs = [];
  for (const d of doctors) {
    docs.push(
      await prisma.doctor.create({
        data: {
          name: d.name,
          specialty: d.specialty,
          color: d.color,
          workingHours: { create: d.hours },
          treatments: { connect: d.treatments.map((k) => ({ id: T[k]!.id })) },
        },
      }),
    );
  }
  const [aisha, arjun, sara] = docs as [(typeof docs)[0], (typeof docs)[0], (typeof docs)[0]];
  const today = todayString();
  await prisma.timeOff.create({
    data: { doctorId: sara.id, start: clinicDateAt(addDays(today, 3), 0), end: clinicDateAt(addDays(today, 4), 0), reason: "Conference" },
  });

  await prisma.reminderRule.createMany({
    data: [
      {
        name: "Appointment reminder · 24h before",
        trigger: "BEFORE_APPOINTMENT",
        offsetHours: 24,
        channel: "WHATSAPP",
        template:
          "Hi {{firstName}}, just a friendly reminder that you're seeing {{doctorName}} tomorrow at {{time}} for your {{treatment}}. Reply YES to confirm or RESCHEDULE if you need a different time. See you soon! – {{clinicName}}",
      },
      {
        name: "Appointment reminder · 2h before",
        trigger: "BEFORE_APPOINTMENT",
        offsetHours: 2,
        channel: "SMS",
        template: "Hi {{firstName}}, we're looking forward to seeing you at {{time}} today with {{doctorName}}. – {{clinicName}}",
      },
      {
        name: "15-day follow-up after treatment",
        trigger: "AFTER_TREATMENT",
        offsetDays: 15,
        channel: "WHATSAPP",
        template:
          "Hi {{firstName}}, it's been about two weeks since your {{treatment}} with {{doctorName}}. How is everything feeling? If you notice any sensitivity or discomfort, just reply here and we'll take care of you. – {{clinicName}}",
      },
      {
        name: "Next-day check after extraction",
        trigger: "AFTER_TREATMENT",
        treatmentTypeId: T.extraction!.id,
        offsetDays: 1,
        channel: "SMS",
        template:
          "Hi {{firstName}}, checking in after yesterday's extraction. Some soreness is normal, but if you have heavy bleeding or swelling please call us at {{clinicPhone}}. Rest up! – {{clinicName}}",
      },
      {
        name: "6-month cleaning recall",
        trigger: "AFTER_TREATMENT",
        treatmentTypeId: T.cleaning!.id,
        offsetDays: 180,
        channel: "WHATSAPP",
        template:
          "Hi {{firstName}}, it's been six months since your last cleaning. Shall we book your next one? Reply with a day that suits you. – {{clinicName}}",
      },
      {
        name: "Missed appointment · rebook",
        trigger: "AFTER_MISSED",
        offsetHours: 1,
        channel: "WHATSAPP",
        template:
          "Hi {{firstName}}, we missed you today! No worries, these things happen. Would you like us to find you a new time for your {{treatment}}? – {{clinicName}}",
      },
    ],
  });

  const people = [
    ["Fathima", "Nasreen", "+919847000101", "Malayalam", "ACTIVE", ["Implant patient"], "Diabetic"],
    ["Rahul", "Krishnan", "+919847000102", "English", "ACTIVE", ["VIP"], null],
    ["Meera", "Nair", "+919847000103", "Malayalam", "NEEDS_FOLLOW_UP", [], "Allergic to penicillin"],
    ["Mohammed", "Ashraf", "+919847000104", "English", "ACTIVE", ["Braces"], null],
    ["Anjali", "Varma", "+919847000105", "Hindi", "NEW", ["Voice AI"], null],
    ["Joseph", "Mathew", "+919847000106", "English", "ACTIVE", [], "Blood thinners"],
    ["Priya", "Suresh", "+919847000107", "English", "LEAD", [], null],
    ["Abdul", "Kareem", "+919847000108", "Arabic", "ACTIVE", ["VIP"], null],
    ["Lakshmi", "Pillai", "+919847000109", "Malayalam", "INACTIVE", [], null],
    ["Vivek", "Raj", "+919847000110", "English", "ACTIVE", [], null],
  ] as const;

  const patients: Awaited<ReturnType<typeof prisma.patient.create>>[] = [];
  for (const [i, [firstName, lastName, phone, language, status, tags, alerts]] of people.entries()) {
    patients.push(
      await prisma.patient.create({
        data: {
          firstName,
          lastName,
          phone,
          email: `${firstName.toLowerCase()}@example.com`,
          language,
          status,
          tags: [...tags],
          medicalAlerts: alerts,
          dateOfBirth: new Date(Date.UTC(1975 + i * 3, i % 12, 5 + i)),
          preferredChannel: i % 3 === 0 ? "SMS" : "WHATSAPP",
          createdAt: new Date(Date.now() - (60 - i * 5) * 86_400_000),
        },
      }),
    );
  }

  const book = async (
    pi: number,
    doctor: { id: string },
    tKey: string,
    date: string,
    minute: number,
    status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW" = "SCHEDULED",
    source: "STAFF" | "VOICE_AI" = "STAFF",
  ) => {
    const t = T[tKey]!;
    const start = clinicDateAt(date, minute);
    const appt = await prisma.appointment.create({
      data: {
        patientId: patients[pi]!.id,
        doctorId: doctor.id,
        treatmentTypeId: t.id,
        start,
        end: new Date(start.getTime() + (t.durationMinutes + t.bufferMinutes) * 60_000),
        status,
        source,
      },
    });
    if (status === "COMPLETED") {
      await prisma.treatmentRecord.create({
        data: { patientId: appt.patientId, doctorId: doctor.id, treatmentTypeId: t.id, appointmentId: appt.id, performedAt: start, cost: t.price },
      });
    }
    return appt;
  };

  // History
  await book(0, arjun, "rootCanal", addDays(today, -15), h(10), "COMPLETED");
  await book(1, aisha, "cleaning", addDays(today, -40), h(9, 30), "COMPLETED");
  await book(2, aisha, "extraction", addDays(today, -1), h(15), "COMPLETED");
  await book(3, sara, "braces", addDays(today, -28), h(11), "COMPLETED");
  await book(5, aisha, "filling", addDays(today, -7), h(16), "COMPLETED");
  await book(8, aisha, "checkup", addDays(today, -400), h(10), "COMPLETED");
  await book(9, arjun, "checkup", addDays(today, -3), h(11), "NO_SHOW");

  // Upcoming
  await book(1, aisha, "checkup", today, h(10), "CONFIRMED");
  await book(4, aisha, "cleaning", today, h(11), "SCHEDULED", "VOICE_AI");
  await book(6, aisha, "whitening", today, h(15), "SCHEDULED", "VOICE_AI");
  await book(0, arjun, "implant", today, h(14, 30), "CONFIRMED");
  await book(7, arjun, "rootCanal", today, h(16), "SCHEDULED");
  await book(3, sara, "braces", today, h(12), "SCHEDULED");
  await book(5, arjun, "checkup", addDays(today, 1), h(10, 30), "SCHEDULED", "VOICE_AI");
  await book(2, aisha, "checkup", addDays(today, 2), h(9), "SCHEDULED");
  await book(9, aisha, "checkup", addDays(today, 2), h(16), "SCHEDULED", "VOICE_AI");

  const records = await prisma.treatmentRecord.findMany({ include: { treatmentType: true } });
  const followUp = await prisma.reminderRule.findFirstOrThrow({ where: { name: "15-day follow-up after treatment" } });
  for (const r of records) {
    const at = clinicDateAt(addDays(today, 0), h(10));
    if (r.patientId === patients[0]!.id) {
      await prisma.reminder.create({
        data: { patientId: r.patientId, ruleId: followUp.id, treatmentRecordId: r.id, channel: "WHATSAPP", scheduledFor: at, dedupeKey: `rule:${followUp.id}:record:${r.id}` },
      });
    }
  }

  await prisma.callLog.createMany({
    data: [
      {
        patientId: patients[4]!.id,
        phone: patients[4]!.phone,
        outcome: "BOOKED",
        durationSec: 154,
        startedAt: new Date(Date.now() - 2 * 3_600_000),
        summary: "New patient Anjali called about bleeding gums. Booked a scaling & cleaning with Dr. Aisha today at 11:00 AM.",
        transcript:
          "AI: Good morning, Smile Studio Dental, this is Maya. How can I help?\nCaller: Hi, my gums bleed when I brush...\nAI: I'm sorry to hear that, let's get you checked. Would 11 this morning work?",
      },
      {
        patientId: patients[5]!.id,
        phone: patients[5]!.phone,
        outcome: "BOOKED",
        durationSec: 98,
        startedAt: new Date(Date.now() - 5 * 3_600_000),
        summary: "Joseph booked a check-up with Dr. Arjun tomorrow 10:30 AM. Mentioned he takes blood thinners.",
      },
      {
        phone: "+919800011122",
        outcome: "ENQUIRY",
        durationSec: 61,
        startedAt: new Date(Date.now() - 26 * 3_600_000),
        summary: "Caller asked about whitening prices and Saturday hours. Did not book.",
      },
      {
        patientId: patients[2]!.id,
        phone: patients[2]!.phone,
        outcome: "EMERGENCY",
        durationSec: 45,
        startedAt: new Date(Date.now() - 20 * 3_600_000),
        summary: "Meera reported swelling after extraction. Transferred to front desk.",
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      { title: "Call Meera about post-extraction swelling", patientId: patients[2]!.id, priority: "URGENT", dueAt: new Date() },
      { title: "Send implant quote to Fathima", patientId: patients[0]!.id, priority: "NORMAL", dueAt: new Date(Date.now() + 86_400_000) },
      { title: "Follow up whitening enquiry (+91 98000 11122)", priority: "LOW" },
    ],
  });

  await prisma.note.createMany({
    data: [
      { patientId: patients[0]!.id, body: "Prefers morning appointments. Nervous about injections — use topical anaesthetic first.", author: "Reception" },
      { patientId: patients[1]!.id, body: "Corporate insurance via employer, bring card next visit.", author: "Reception" },
    ],
  });

  console.log("Seeded demo clinic.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

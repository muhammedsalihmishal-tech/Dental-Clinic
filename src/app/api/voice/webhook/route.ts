import { NextResponse } from "next/server";
import type { CallOutcome } from "@prisma/client";
import { isVoiceRequestAuthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

const OUTCOMES: CallOutcome[] = ["BOOKED", "RESCHEDULED", "CANCELLED", "ENQUIRY", "TRANSFERRED", "EMERGENCY", "MISSED", "OTHER"];

/** Stores the end-of-call report (summary, transcript, recording) and links it to the patient. */
export async function POST(req: Request) {
  if (!isVoiceRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const msg = body?.message ?? body;
  if (!msg || msg.type !== "end-of-call-report") return NextResponse.json({ ok: true, ignored: true });

  const call = msg.call ?? {};
  const rawPhone: string = call.customer?.number ?? msg.customer?.number ?? "unknown";
  const phone = rawPhone === "unknown" ? rawPhone : normalizePhone(rawPhone);
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const patient =
    last10.length === 10
      ? await prisma.patient.findFirst({ where: { OR: [{ phone }, { phone: { endsWith: last10 } }] } })
      : null;

  const reported = String(msg.analysis?.structuredData?.outcome ?? "").toUpperCase() as CallOutcome;
  const endedReason: string = msg.endedReason ?? "";
  const outcome: CallOutcome = OUTCOMES.includes(reported)
    ? reported
    : /no-answer|did-not-answer|busy|voicemail/.test(endedReason)
      ? "MISSED"
      : /forward|transfer/.test(endedReason)
        ? "TRANSFERRED"
        : "OTHER";

  const data = {
    patientId: patient?.id,
    phone,
    direction: call.type === "outboundPhoneCall" ? ("OUTBOUND" as const) : ("INBOUND" as const),
    outcome,
    startedAt: msg.startedAt ? new Date(msg.startedAt) : new Date(),
    durationSec: Math.round(Number(msg.durationSeconds ?? 0)),
    summary: msg.analysis?.summary ?? msg.summary ?? null,
    transcript: msg.transcript ?? msg.artifact?.transcript ?? null,
    recordingUrl: msg.recordingUrl ?? msg.artifact?.recordingUrl ?? null,
  };

  if (call.id) {
    await prisma.callLog.upsert({ where: { providerCallId: call.id }, create: { providerCallId: call.id, ...data }, update: data });
  } else {
    await prisma.callLog.create({ data });
  }
  return NextResponse.json({ ok: true });
}

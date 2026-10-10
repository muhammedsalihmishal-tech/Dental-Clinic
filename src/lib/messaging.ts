import type { Channel } from "@prisma/client";

export type SendResult = { ok: boolean; simulated: boolean; providerId?: string; error?: string };

const twilio = {
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  smsFrom: process.env.TWILIO_SMS_FROM,
  whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
};

async function sendTwilio(from: string, to: string, body: string): Promise<SendResult> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilio.sid}:${twilio.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  return res.ok
    ? { ok: true, simulated: false, providerId: json.sid }
    : { ok: false, simulated: false, error: json.message ?? `Twilio HTTP ${res.status}` };
}

/**
 * Deliver a message to a patient. Channels without a configured provider are simulated
 * (logged and reported as sent) so the CRM works end-to-end in development.
 */
export async function sendMessage(channel: Channel, to: string, body: string): Promise<SendResult> {
  if (twilio.sid && twilio.token) {
    if (channel === "SMS" && twilio.smsFrom) return sendTwilio(twilio.smsFrom, to, body);
    if (channel === "WHATSAPP" && twilio.whatsappFrom)
      return sendTwilio(`whatsapp:${twilio.whatsappFrom}`, `whatsapp:${to}`, body);
  }
  console.info(`[messaging:simulated] ${channel} -> ${to}: ${body}`);
  return { ok: true, simulated: true };
}

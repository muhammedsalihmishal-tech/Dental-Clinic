import { NextResponse } from "next/server";
import { processInboundReply } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Twilio sends inbound SMS/WhatsApp messages here.
 * Configure your Twilio number's "A message comes in" webhook to:
 *   POST https://<your-domain>/api/webhooks/twilio
 *
 * Twilio signs the request — validate the signature in production by setting
 * TWILIO_AUTH_TOKEN and checking X-Twilio-Signature with twilio.validateRequest().
 */
export async function POST(req: Request) {
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const from = (params.get("From") ?? "").replace("whatsapp:", "");
  const body = params.get("Body") ?? "";
  const to = params.get("To") ?? "";

  if (!from || !body) return new NextResponse(twiml(""), { headers: { "Content-Type": "text/xml" } });

  const channel: "SMS" | "WHATSAPP" = to.startsWith("whatsapp:") ? "WHATSAPP" : "SMS";
  const raw: Record<string, string> = {};
  params.forEach((v, k) => { raw[k] = v; });

  await processInboundReply(from, body, channel, raw);

  // Return empty TwiML so Twilio doesn't complain.
  return new NextResponse(twiml(""), { headers: { "Content-Type": "text/xml" } });
}

function twiml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${message}</Message>` : ""}</Response>`;
}

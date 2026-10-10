import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface MessageContext {
  firstName: string;
  fullName: string;
  language: string;
  preferredChannel: string;
  medicalAlerts?: string | null;
  treatmentName?: string;
  doctorName?: string;
  date?: string;
  clinicName: string;
  clinicPhone: string;
  ruleName: string;
  templateFallback: string;
}

/**
 * Generate a personalised, human-sounding message using Claude.
 * Returns the template fallback when the API key is not configured or the call fails.
 */
export async function generatePersonalisedMessage(ctx: MessageContext): Promise<string> {
  const client = getClient();
  if (!client) return ctx.templateFallback;

  try {
    const system = `You are Maya, the warm and friendly receptionist at ${ctx.clinicName}.
Write a short, natural ${ctx.preferredChannel === "WHATSAPP" ? "WhatsApp" : "SMS"} message in ${ctx.language}.
Keep it under 160 words, conversational (not formal), no bullet points, no robotic phrasing.
End with "– ${ctx.clinicName}". Never include links, never make up medical advice.`;

    const prompt = `Write a personalised follow-up message for this patient:
- Name: ${ctx.firstName} (full: ${ctx.fullName})
- Purpose: ${ctx.ruleName}
- Treatment: ${ctx.treatmentName ?? "dental visit"}
- Doctor: ${ctx.doctorName ?? "the doctor"}
${ctx.date ? `- Appointment/treatment date: ${ctx.date}` : ""}
${ctx.medicalAlerts ? `- Medical notes (don't mention explicitly, just be extra caring): ${ctx.medicalAlerts}` : ""}

Template you can draw inspiration from (improve it — make it more personal and warm):
"${ctx.templateFallback}"

Write only the message text, nothing else.`;

    const response = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    return text || ctx.templateFallback;
  } catch {
    return ctx.templateFallback;
  }
}

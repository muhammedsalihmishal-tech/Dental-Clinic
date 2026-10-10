import { NextResponse } from "next/server";
import { isVoiceRequestAuthorized } from "@/lib/auth";
import { runVoiceTool, voiceToolDefinitions } from "@/lib/voice-tools";

export const dynamic = "force-dynamic";

type VapiToolCall = { id: string; function: { name: string; arguments: unknown } };

const parseArgs = (a: unknown) => {
  if (typeof a !== "string") return a;
  try {
    return JSON.parse(a);
  } catch {
    return {};
  }
};

/** Tool definitions, ready to paste into the voice provider's assistant config. */
export async function GET(req: Request) {
  if (!isVoiceRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tools: voiceToolDefinitions() });
}

/**
 * Accepts either Vapi's `tool-calls` server message:
 *   { message: { type: "tool-calls", toolCallList: [{ id, function: { name, arguments } }] } }
 * or a plain call (Retell custom functions, scripts, tests):
 *   { tool: "check_availability", arguments: { ... } }
 */
export async function POST(req: Request) {
  if (!isVoiceRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const calls: VapiToolCall[] | undefined = body.message?.toolCallList ?? body.message?.toolCalls;
  if (Array.isArray(calls)) {
    const results = await Promise.all(
      calls.map(async (c) => ({
        toolCallId: c.id,
        result: JSON.stringify(await runVoiceTool(c.function.name, parseArgs(c.function.arguments))),
      })),
    );
    return NextResponse.json({ results });
  }

  const name = body.tool ?? body.name;
  if (typeof name !== "string") return NextResponse.json({ error: "Missing tool name" }, { status: 400 });
  return NextResponse.json({ result: await runVoiceTool(name, parseArgs(body.arguments ?? body.args)) });
}

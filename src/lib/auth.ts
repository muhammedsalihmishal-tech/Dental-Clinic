import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Voice providers send the shared secret in `x-voice-secret` (or as a Bearer token). */
export function isVoiceRequestAuthorized(req: Request): boolean {
  const secret = process.env.VOICE_TOOL_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-voice-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(header, secret);
}

export function isCronRequestAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(header, secret);
}

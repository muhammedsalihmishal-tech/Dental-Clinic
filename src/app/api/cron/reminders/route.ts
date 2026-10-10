import { NextResponse } from "next/server";
import { isCronRequestAuthorized } from "@/lib/auth";
import { processDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/** Call every few minutes from a scheduler (Vercel Cron, GitHub Actions, crontab + curl). */
async function handle(req: Request) {
  if (!isCronRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await processDueReminders());
}

export { handle as GET, handle as POST };

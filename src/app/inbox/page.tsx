import { CheckCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { fullName, CHANNEL_LABEL } from "@/lib/utils";
import { Empty, PageHeader } from "@/components/ui";
import Link from "next/link";
import { markInboundHandled, markAllInboundHandled } from "../actions";
import { InboxReply } from "./InboxReply";

export const dynamic = "force-dynamic";

const INTENT_COLOR: Record<string, string> = {
  CONFIRM: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  RESCHEDULE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CANCEL: "bg-rose-500/15 text-rose-500",
  OPT_OUT: "bg-slate-500/15 text-slate-500",
  UNKNOWN: "bg-muted/30 text-muted",
};

export default async function InboxPage({ searchParams }: { searchParams: { handled?: string } }) {
  const showHandled = searchParams.handled === "1";

  const messages = await prisma.inboundMessage.findMany({
    where: { handled: showHandled },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Look up patients by phone numbers
  const phones = [...new Set(messages.map((m) => m.from))];
  const patients = await prisma.patient.findMany({
    where: { phone: { in: phones } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const byPhone = Object.fromEntries(patients.map((p) => [p.phone, p]));

  const unhandledCount = await prisma.inboundMessage.count({ where: { handled: false } });

  return (
    <>
      <PageHeader
        title="Inbound replies"
        subtitle={`${unhandledCount} unhandled · SMS & WhatsApp responses from patients`}
        actions={
          <div className="flex gap-2">
            {!showHandled && unhandledCount > 0 && (
              <form action={markAllInboundHandled}>
                <button className="btn-ghost gap-1.5"><CheckCheck className="h-4 w-4" />Mark all handled</button>
              </form>
            )}
            <Link
              href={showHandled ? "/inbox" : "/inbox?handled=1"}
              className="btn-ghost"
            >
              {showHandled ? "Show unhandled" : "Show handled"}
            </Link>
          </div>
        }
      />

      <div className="card divide-y divide-border fade-in">
        {messages.length === 0 && (
          <Empty>
            {showHandled ? "No handled messages." : "No unhandled messages."}
          </Empty>
        )}
        {messages.map((msg) => {
          const patient = byPhone[msg.from];
          return (
            <div key={msg.id} className="px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {patient ? (
                      <Link href={`/patients/${patient.id}`} className="font-medium hover:underline">
                        {fullName(patient)}
                      </Link>
                    ) : (
                      <span className="font-medium text-muted">{msg.from}</span>
                    )}
                    <span className="text-xs text-muted">{CHANNEL_LABEL[msg.channel]}</span>
                    {msg.intent && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTENT_COLOR[msg.intent] ?? INTENT_COLOR.UNKNOWN}`}>
                        {msg.intent}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{msg.body}</p>
                  <p className="mt-0.5 text-xs text-muted">{fmtDateTime(msg.createdAt)}</p>
                </div>
                {!msg.handled && (
                  <div className="flex shrink-0 gap-1">
                    <form action={markInboundHandled}>
                      <input type="hidden" name="id" value={msg.id} />
                      <button className="btn-ghost btn-sm">Done</button>
                    </form>
                  </div>
                )}
              </div>
              {!msg.handled && (
                <div className="mt-2 pl-0">
                  <InboxReply id={msg.id} phone={msg.from} channel={msg.channel} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

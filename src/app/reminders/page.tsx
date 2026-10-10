import Link from "next/link";
import { Play, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { fullName, titleCase, CHANNEL_LABEL } from "@/lib/utils";
import { Badge, Card, Empty, Field, PageHeader } from "@/components/ui";
import { ReminderBadge } from "@/components/badges";
import { cancelReminder, createRule, deleteRule, runRemindersNow, toggleRule } from "../actions";
import { ReactivateButton } from "./ReactivateButton";

export const dynamic = "force-dynamic";

function describe(rule: { trigger: string; offsetDays: number; offsetHours: number }) {
  const parts = [rule.offsetDays && `${rule.offsetDays} day${rule.offsetDays === 1 ? "" : "s"}`, rule.offsetHours && `${rule.offsetHours}h`].filter(Boolean).join(" ");
  if (rule.trigger === "BEFORE_APPOINTMENT") return `${parts || "0h"} before the appointment`;
  if (rule.trigger === "AFTER_MISSED") return `${parts || "Right"} after a missed appointment`;
  return `${parts || "Same day"} after the treatment`;
}

export default async function RemindersPage() {
  const [rules, treatments, queue, history] = await Promise.all([
    prisma.reminderRule.findMany({ include: { treatmentType: true, _count: { select: { reminders: { where: { status: "SENT" } } } } }, orderBy: { createdAt: "asc" } }),
    prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
    prisma.reminder.findMany({ where: { status: "PENDING" }, include: { patient: true, rule: true }, orderBy: { scheduledFor: "asc" }, take: 50 }),
    prisma.reminder.findMany({ where: { status: { not: "PENDING" } }, include: { patient: true, rule: true }, orderBy: { scheduledFor: "desc" }, take: 30 }),
  ]);

  return (
    <>
      <PageHeader
        title="Follow-ups & reminders"
        subtitle="Rules run automatically: appointment reminders, post-treatment check-ins, recalls and no-show rebooking."
        actions={
          <div className="flex gap-2">
            <ReactivateButton />
            <form action={runRemindersNow}>
              <button className="btn-ghost"><Play className="h-4 w-4" /> Send due messages now</button>
            </form>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {rules.map((r) => (
            <div key={r.id} className="card fade-in p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.active ? <Badge tone="emerald">Active</Badge> : <Badge>Paused</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {describe(r)} · {r.treatmentType ? r.treatmentType.name : "any treatment"} · via {CHANNEL_LABEL[r.channel]} · {r._count.reminders} sent
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={toggleRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost btn-sm">{r.active ? "Pause" : "Activate"}</button>
                  </form>
                  <form action={deleteRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost btn-sm text-rose-500" aria-label="Delete rule"><Trash2 className="h-3.5 w-3.5" /></button>
                  </form>
                </div>
              </div>
              <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">{r.template}</p>
            </div>
          ))}
        </div>

        <Card title="New rule">
          <form action={createRule} className="space-y-3 p-5">
            <Field label="Name"><input name="name" required placeholder="e.g. 15-day check-in after root canal" className="input" /></Field>
            <Field label="When">
              <select name="trigger" className="input">
                <option value="AFTER_TREATMENT">After a treatment is completed</option>
                <option value="BEFORE_APPOINTMENT">Before an appointment</option>
                <option value="AFTER_MISSED">After a missed appointment</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Days"><input name="offsetDays" type="number" min={0} defaultValue={15} className="input" /></Field>
              <Field label="Hours"><input name="offsetHours" type="number" min={0} defaultValue={0} className="input" /></Field>
            </div>
            <Field label="For treatment">
              <select name="treatmentTypeId" className="input">
                <option value="">Any treatment</option>
                {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Channel">
              <select name="channel" className="input">
                <option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option>
              </select>
            </Field>
            <Field label="Message">
              <textarea name="template" rows={4} required className="input" defaultValue={"Hi {{firstName}}, it's been a couple of weeks since your {{treatment}} with {{doctorName}}. How are you feeling? Just reply here if anything doesn't feel right. – {{clinicName}}"} />
            </Field>
            <p className="text-xs text-muted">
              Variables: {"{{firstName}} {{fullName}} {{treatment}} {{doctorName}} {{date}} {{time}} {{clinicName}} {{clinicPhone}}"}. Day-based messages go out at 10 AM; nothing is sent between 9 PM and 8 AM.
            </p>
            <button className="btn-primary w-full">Create rule</button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title={`Queue · ${queue.length} scheduled`}>
          {queue.length === 0 ? <Empty>Nothing scheduled.</Empty> : (
            <ul className="divide-y divide-border">
              {queue.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/patients/${r.patientId}`} className="font-medium hover:text-brand">{fullName(r.patient)}</Link>
                    <div className="truncate text-xs text-muted">{r.rule?.name ?? "Message"} · {CHANNEL_LABEL[r.channel]}</div>
                  </div>
                  <span className="text-xs tabular-nums text-muted">{fmtDateTime(r.scheduledFor)}</span>
                  <form action={cancelReminder}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost btn-sm">Cancel</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recently sent">
          {history.length === 0 ? <Empty>No messages sent yet.</Empty> : (
            <ul className="divide-y divide-border">
              {history.map((r) => (
                <li key={r.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/patients/${r.patientId}`} className="font-medium hover:text-brand">{fullName(r.patient)}</Link>
                    <ReminderBadge status={r.status} />
                  </div>
                  <div className="text-xs text-muted">{r.rule?.name ?? "Message"} · {fmtDateTime(r.sentAt ?? r.scheduledFor)}{r.error ? ` · ${r.error}` : ""}</div>
                  {r.message && <p className="mt-1 line-clamp-2 text-xs">{r.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { saveReminderRule, deleteReminderRule } from "../../actions";

export const dynamic = "force-dynamic";

const TRIGGERS = [
  { value: "BEFORE_APPOINTMENT", label: "Before appointment" },
  { value: "AFTER_TREATMENT", label: "After treatment record" },
  { value: "AFTER_MISSED", label: "After missed appointment" },
  { value: "AFTER_COMPLETED", label: "After completed visit" },
];

const CHANNELS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" },
];

const VARS = ["firstName", "fullName", "clinicName", "clinicPhone", "doctorName", "treatment", "date", "time", "reviewLink"];

export default async function SettingsRemindersPage() {
  const [rules, treatments] = await Promise.all([
    prisma.reminderRule.findMany({ include: { treatmentType: true }, orderBy: { createdAt: "asc" } }),
    prisma.treatmentType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Reminder rules"
        subtitle="Configure when and how automated follow-up messages are sent."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {rules.length === 0 && <Empty>No reminder rules yet.</Empty>}
          {rules.map((rule) => (
            <div key={rule.id} className="card fade-in p-5">
              <form action={saveReminderRule} className="space-y-3">
                <input type="hidden" name="id" value={rule.id} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Rule name" className="col-span-2 sm:col-span-4">
                    <input name="name" defaultValue={rule.name} required className="input" />
                  </Field>
                  <Field label="Trigger">
                    <select name="trigger" defaultValue={rule.trigger} className="input">
                      {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Channel">
                    <select name="channel" defaultValue={rule.channel} className="input">
                      {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Offset days">
                    <input name="offsetDays" type="number" min={0} defaultValue={rule.offsetDays} className="input" />
                  </Field>
                  <Field label="Offset hours">
                    <input name="offsetHours" type="number" min={0} max={23} defaultValue={rule.offsetHours} className="input" />
                  </Field>
                  <Field label="Treatment type (optional)" className="col-span-2">
                    <select name="treatmentTypeId" defaultValue={rule.treatmentTypeId ?? ""} className="input">
                      <option value="">Any treatment</option>
                      {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Active">
                    <select name="active" defaultValue={rule.active ? "true" : "false"} className="input">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>
                <Field label="Message template">
                  <textarea name="template" defaultValue={rule.template} rows={3} className="input" />
                </Field>
                <div className="flex items-center justify-between gap-2">
                  <form action={deleteReminderRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="btn-ghost btn-sm text-rose-500" aria-label="Delete rule">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <button type="submit" className="btn-primary btn-sm">Save</button>
                </div>
              </form>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <Card title="New rule">
            <form action={saveReminderRule} className="space-y-3 p-5">
              <Field label="Rule name"><input name="name" required placeholder="e.g. 24h appointment reminder" className="input" /></Field>
              <Field label="Trigger">
                <select name="trigger" className="input">
                  {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Days offset"><input name="offsetDays" type="number" min={0} defaultValue={0} className="input" /></Field>
                <Field label="Hours offset"><input name="offsetHours" type="number" min={0} max={23} defaultValue={0} className="input" /></Field>
              </div>
              <Field label="Channel">
                <select name="channel" className="input">
                  {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Treatment type (optional)">
                <select name="treatmentTypeId" className="input">
                  <option value="">Any treatment</option>
                  {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Message template">
                <textarea name="template" rows={3} className="input" placeholder="Hi {{firstName}}, your appointment for {{treatment}} is tomorrow at {{time}}. See you soon! – {{clinicName}}" />
              </Field>
              <button className="btn-primary w-full">Create rule</button>
            </form>
          </Card>

          <Card title="Template variables">
            <ul className="space-y-1 p-5">
              {VARS.map((v) => (
                <li key={v} className="font-mono text-xs text-muted">{`{{${v}}}`}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { createCampaign, sendCampaign } from "../actions";
import { Send } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted/30 text-muted",
  SENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const PATIENT_STATUSES = ["LEAD", "NEW", "ACTIVE", "NEEDS_FOLLOW_UP", "INACTIVE"];
const CHANNELS = ["WHATSAPP", "SMS", "EMAIL"];

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Bulk messages to patient segments"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {campaigns.length === 0 && <Empty>No campaigns yet.</Empty>}
          {campaigns.map((c) => {
            const seg = c.segment as { statuses?: string[]; tags?: string[]; lastSeenBeforeDays?: number };
            return (
              <div key={c.id} className="card fade-in p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                        {c.status}
                      </span>
                      <span className="text-xs text-muted">{c.channel}</span>
                    </div>
                    <p className="mt-1 text-sm line-clamp-2">{c.message}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                      {seg.statuses?.length ? <span>Status: {seg.statuses.join(", ")}</span> : null}
                      {seg.tags?.length ? <span>Tags: {seg.tags.join(", ")}</span> : null}
                      {seg.lastSeenBeforeDays ? <span>Not seen in {seg.lastSeenBeforeDays}d</span> : null}
                    </div>
                    {c.status === "SENT" && (
                      <p className="mt-1 text-xs text-muted">
                        Sent {fmtDateTime(c.sentAt!)} · {c.sentCount} delivered · {c.failCount} failed ·{" "}
                        <Link href={`/campaigns/${c.id}`} className="text-brand hover:underline">View details</Link>
                      </p>
                    )}
                    {c.status === "DRAFT" && (
                      <p className="mt-1 text-xs text-muted">Created {fmtDateTime(c.createdAt)}</p>
                    )}
                  </div>
                  {c.status === "DRAFT" && (
                    <form action={sendCampaign} className="shrink-0">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-primary btn-sm gap-1">
                        <Send className="h-3.5 w-3.5" /> Send
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Card title="New campaign">
          <form action={createCampaign} className="space-y-3 p-5">
            <Field label="Campaign name">
              <input name="name" required className="input" placeholder="e.g. October cleaning reminder" />
            </Field>
            <Field label="Channel">
              <select name="channel" className="input">
                {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
              </select>
            </Field>
            <Field label="Message">
              <textarea
                name="message"
                required
                className="input min-h-[96px]"
                placeholder="Hi {{name}}, …&#10;&#10;Use {{name}}, {{clinic}}, {{phone}} as variables."
              />
            </Field>

            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Segment filters</p>
              <Field label="Patient statuses (leave blank for all)">
                <div className="flex flex-wrap gap-2">
                  {PATIENT_STATUSES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" name="statuses" value={s} className="accent-brand" />
                      {s}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Tags (comma-separated, any match)">
                <input name="tags" className="input" placeholder="e.g. VIP, orthodontics" />
              </Field>
              <Field label="Not seen in last N days (0 = ignore)">
                <input name="lastSeenBeforeDays" type="number" min={0} className="input" placeholder="0" />
              </Field>
            </div>

            <button className="btn-primary w-full">Create draft</button>
          </form>
        </Card>
      </div>
    </>
  );
}

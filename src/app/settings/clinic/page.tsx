import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clinic } from "@/lib/config";
import { Card, Field, PageHeader } from "@/components/ui";
import { saveClinicSettings } from "../actions";

export const dynamic = "force-dynamic";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

export default async function ClinicSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== "ADMIN") redirect("/");

  const settings = await prisma.clinicSettings.findUnique({ where: { id: "default" } });

  const current = {
    name: settings?.name ?? clinic.name,
    phone: settings?.phone ?? clinic.phone,
    address: settings?.address ?? clinic.address,
    timezone: settings?.timezone ?? clinic.timezone,
  };

  return (
    <>
      <PageHeader
        title="Clinic settings"
        subtitle="Name, contact details, and timezone shown in messages"
        icon={Building2}
      />

      <div className="max-w-xl">
        <Card title="Clinic profile">
          <form action={saveClinicSettings} className="space-y-4 p-5">
            <Field label="Clinic name">
              <input
                name="name"
                required
                defaultValue={current.name}
                className="input"
                placeholder="e.g. Smile Studio Dental"
              />
            </Field>
            <Field label="Phone number">
              <input
                name="phone"
                defaultValue={current.phone}
                className="input"
                placeholder="e.g. +91 98765 43210"
              />
            </Field>
            <Field label="Address (shown in messages)">
              <textarea
                name="address"
                defaultValue={current.address}
                rows={2}
                className="input"
                placeholder="123 Main Street, City"
              />
            </Field>
            <Field label="Timezone">
              <select name="timezone" defaultValue={current.timezone} className="input">
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-muted">
              These values are used in SMS, WhatsApp, and email messages sent to patients.
              Changes take effect immediately on the next outgoing message.
            </p>
            <button className="btn-primary">Save changes</button>
          </form>
        </Card>
      </div>
    </>
  );
}

import type { AppointmentStatus, CallOutcome, PatientStatus, ReminderStatus } from "@prisma/client";
import { Badge, type Tone } from "./ui";
import { titleCase } from "@/lib/utils";

const apptTone: Record<AppointmentStatus, Tone> = {
  HELD: "amber",
  SCHEDULED: "indigo",
  CONFIRMED: "teal",
  COMPLETED: "emerald",
  CANCELLED: "gray",
  NO_SHOW: "rose",
};
const patientTone: Record<PatientStatus, Tone> = {
  LEAD: "violet",
  NEW: "indigo",
  ACTIVE: "emerald",
  NEEDS_FOLLOW_UP: "amber",
  INACTIVE: "gray",
};
const reminderTone: Record<ReminderStatus, Tone> = {
  PENDING: "indigo",
  SENT: "emerald",
  FAILED: "rose",
  SKIPPED: "gray",
  CANCELLED: "gray",
};
const callTone: Record<CallOutcome, Tone> = {
  BOOKED: "emerald",
  RESCHEDULED: "teal",
  CANCELLED: "gray",
  ENQUIRY: "indigo",
  TRANSFERRED: "violet",
  EMERGENCY: "rose",
  MISSED: "amber",
  OTHER: "gray",
};

export const AppointmentBadge = ({ status }: { status: AppointmentStatus }) => <Badge tone={apptTone[status]}>{titleCase(status)}</Badge>;
export const PatientBadge = ({ status }: { status: PatientStatus }) => <Badge tone={patientTone[status]}>{titleCase(status)}</Badge>;
export const ReminderBadge = ({ status }: { status: ReminderStatus }) => <Badge tone={reminderTone[status]}>{titleCase(status)}</Badge>;
export const CallBadge = ({ outcome }: { outcome: CallOutcome }) => <Badge tone={callTone[outcome]}>{titleCase(outcome)}</Badge>;

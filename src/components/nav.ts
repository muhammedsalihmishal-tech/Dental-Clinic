import { BarChart3, Bell, CalendarCheck, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, ListChecks, Megaphone, MessageSquare, PhoneCall, Settings, Stethoscope, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/reminders", label: "Follow-ups", icon: Bell },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/plans", label: "Treatment plans", icon: ListChecks },
  { href: "/recall", label: "Recall queue", icon: CalendarCheck },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/lab", label: "Lab orders", icon: FlaskConical },
  { href: "/calls", label: "AI Calls", icon: PhoneCall },
  { href: "/waitlist", label: "Waitlist", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings/treatments", label: "Treatments", icon: Settings },
  { href: "/settings/reminders", label: "Reminder rules", icon: Bell },
];

import { BarChart3, Bell, CalendarDays, ClipboardList, FileText, LayoutDashboard, MessageSquare, PhoneCall, Settings, Stethoscope, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/reminders", label: "Follow-ups", icon: Bell },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/calls", label: "AI Calls", icon: PhoneCall },
  { href: "/waitlist", label: "Waitlist", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings/treatments", label: "Treatments", icon: Settings },
  { href: "/settings/reminders", label: "Reminder rules", icon: Bell },
];

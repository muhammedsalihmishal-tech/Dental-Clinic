import { BarChart3, Bell, CalendarDays, ClipboardList, LayoutDashboard, PhoneCall, Settings, Stethoscope, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/reminders", label: "Follow-ups", icon: Bell },
  { href: "/calls", label: "AI Calls", icon: PhoneCall },
  { href: "/waitlist", label: "Waitlist", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings/treatments", label: "Treatments", icon: Settings },
];

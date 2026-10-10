import { Bell, CalendarDays, LayoutDashboard, PhoneCall, Stethoscope, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/reminders", label: "Follow-ups", icon: Bell },
  { href: "/calls", label: "AI Calls", icon: PhoneCall },
];

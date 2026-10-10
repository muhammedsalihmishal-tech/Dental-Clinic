import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Keep a leading + and digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export const CHANNEL_LABEL = { SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email", CALL: "Phone call" } as const;

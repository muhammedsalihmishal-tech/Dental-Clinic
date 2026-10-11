import { createHmac } from "crypto";

const secret = process.env.BOOKING_SECRET ?? "insecure-booking-secret";

export function signBookingToken(appointmentId: string): string {
  const sig = createHmac("sha256", secret).update(appointmentId).digest("hex");
  return Buffer.from(`${appointmentId}.${sig}`).toString("base64url");
}

export function verifyBookingToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    if (dot < 1) return null;
    const id = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const expected = createHmac("sha256", secret).update(id).digest("hex");
    return sig === expected ? id : null;
  } catch {
    return null;
  }
}

export function manageBookingUrl(appointmentId: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/book/manage?token=${signBookingToken(appointmentId)}`;
}

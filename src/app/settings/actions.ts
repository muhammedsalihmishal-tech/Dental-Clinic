"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

export async function saveClinicSettings(form: FormData) {
  const data = {
    name: String(form.get("name") ?? "").trim() || "Smile Studio Dental",
    phone: String(form.get("phone") ?? "").trim(),
    address: String(form.get("address") ?? "").trim(),
    timezone: String(form.get("timezone") ?? "Asia/Kolkata").trim(),
  };
  await prisma.clinicSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  revalidatePath("/settings/clinic");
  revalidatePath("/", "layout");
}

export async function createUser(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "RECEPTIONIST") as UserRole;
  const password = String(form.get("password") ?? "");
  if (!name || !email || !password) return;
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, role, passwordHash } });
  await audit("CREATE", "User", user.id, `${name} (${role})`);
  revalidatePath("/settings/users");
}

export async function toggleUser(form: FormData) {
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "true";
  await prisma.user.update({ where: { id }, data: { active } });
  await audit("UPDATE", "User", id, active ? "activated" : "deactivated");
  revalidatePath("/settings/users");
}

export async function resetPassword(form: FormData) {
  const id = String(form.get("id") ?? "");
  const password = String(form.get("password") ?? "");
  if (!id || password.length < 8) return;
  const passwordHash = await hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

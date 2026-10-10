"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export async function createUser(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "RECEPTIONIST") as UserRole;
  const password = String(form.get("password") ?? "");
  if (!name || !email || !password) return;
  const passwordHash = await hash(password, 12);
  await prisma.user.create({ data: { name, email, role, passwordHash } });
  revalidatePath("/settings/users");
}

export async function toggleUser(form: FormData) {
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "true";
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath("/settings/users");
}

export async function resetPassword(form: FormData) {
  const id = String(form.get("id") ?? "");
  const password = String(form.get("password") ?? "");
  if (!id || password.length < 8) return;
  const passwordHash = await hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

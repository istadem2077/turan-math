"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { startSession, endSession, verifyPassword } from "@/lib/auth";

export async function login(_: { error?: string } | undefined, form: FormData) {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect username or password." };
  }
  await startSession(user);
  redirect(user.role === "STUDENT" ? "/student" : "/staff");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSession, safeNext, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  if (!(await checkPassword(String(form.get("password") ?? "")))) {
    // A short pause makes guessing slow without needing a store for attempts.
    await new Promise((r) => setTimeout(r, 600));
    return "That password didn't match.";
  }
  (await cookies()).set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(form.get("next")));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

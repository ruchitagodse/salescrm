"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };
const failure = { error: "Unable to sign in. Check your credentials and try again." };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" || typeof password !== "string" ||
    !email.trim() || !password || email.length > 320 || password.length > 4096
  ) return failure;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (error) return failure;
    // Verify with Auth before granting entry; never trust getSession().
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return failure;
  } catch {
    return failure;
  }
  redirect("/");
}

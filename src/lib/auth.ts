import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { boundedAuthRead } from "./request-timeout";

// React cache deduplicates within a render request, never across users.
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  // Auth SDKs read the clock for token expiry. Wait for a real request before
  // entering SDK code; keep this outside the catch so prerendering can suspend.
  await connection();
  const started=performance.now();
  try {
    const supabase = await createClient();
    const { data, error } = await boundedAuthRead(supabase.auth.getUser());
    return error ? null : data.user;
  } catch {
    return null;
  } finally {const durationMs=Math.round(performance.now()-started);if(durationMs>1500)console.info('CRM authentication slow',{durationMs});}
});

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

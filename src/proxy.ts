import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Explicitly exempt current public assets; do not exempt arbitrary dotted
  // paths or API routes, which could otherwise bypass protection.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico$|file\\.svg$|globe\\.svg$|next\\.svg$|vercel\\.svg$|window\\.svg$).*)",
  ],
};

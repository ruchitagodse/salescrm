import "server-only";

import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function ensureCurrentProfile() {
  // Authorization is enforced at the data operation as well as the layout.
  const user = await requireUser();
  try {
    // Driver initialization must also happen after the request-time auth gate,
    // rather than as a side effect of importing the protected layout.
    const { db } = await import("@/db");
    await db.insert(profiles).values({ id: user.id }).onConflictDoNothing({
      target: profiles.id,
    });
  } catch {
    // Raw Drizzle errors can contain SQL parameters or connection details.
    console.error("Authenticated profile initialization failed.");
    throw new Error("Unable to prepare your account. Please try again later.");
  }
}

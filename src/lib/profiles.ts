import "server-only";

import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function ensureCurrentProfile() {
  const started=performance.now();
  // Authorization is enforced at the data operation as well as the layout.
  const user = await requireUser();
  try {
    // Driver initialization must also happen after the request-time auth gate,
    // rather than as a side effect of importing the protected layout.
    const { db } = await import("@/db");
    await db.transaction(async tx => {
      await tx.execute(sql`set local statement_timeout='8s'`);
      await tx.execute(sql`set local lock_timeout='3s'`);
      const [existing] = await tx.select({id:profiles.id}).from(profiles).where(eq(profiles.id,user.id));
      if (!existing) await tx.insert(profiles).values({id:user.id}).onConflictDoNothing({target:profiles.id});
    });
  } catch {
    // Raw Drizzle errors can contain SQL parameters or connection details.
    console.error("Authenticated profile initialization failed.");
    throw new Error("Unable to prepare your account. Please try again later.");
  } finally {const durationMs=Math.round(performance.now()-started);if(durationMs>1500)console.info('CRM profile initialization slow',{durationMs});}
}

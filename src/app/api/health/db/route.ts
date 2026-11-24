import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  await connection();
  if (!(await getAuthenticatedUser())) {
    return Response.json(
      { ok: false, error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    // Import inside the boundary so configuration failures also receive a generic response.
    const { db } = await import("@/db");
    const [row] = await db.execute<{ server_time: Date | string }>(
      sql`select now() as server_time`,
    );

    return Response.json(
      { ok: true, serverTime: row.server_time },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Driver messages/stacks can contain connection details. Log real error
    // classification only; never serialize raw errors or environment values.
    const diagnostics: { type: string; code?: string }[] = [];
    let current: unknown = error;

    // Drizzle wraps driver errors in `cause`; retain useful classifications
    // without logging SQL parameters, URLs, passwords or raw error messages.
    for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
      const code = "code" in current ? String(current.code) : undefined;
      diagnostics.push({
        type: current.constructor.name,
        code: code && /^[A-Z0-9_]{1,40}$/.test(code) ? code : undefined,
      });
      current = current.cause;
    }

    console.error("Database health check failed", diagnostics);

    return Response.json(
      { ok: false, error: "Database connection failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

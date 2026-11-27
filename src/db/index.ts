import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for server-side database access.");
}

const globalForDb = globalThis as typeof globalThis & {
  osPostgresClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.osPostgresClient ?? postgres(databaseUrl, {
    prepare: false, connect_timeout: 8, idle_timeout: 20, max_lifetime: 300, max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.osPostgresClient = client;
}

export const db = drizzle(client);

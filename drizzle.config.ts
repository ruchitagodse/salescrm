import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });

const migrationsUrl = process.env.DATABASE_URL_MIGRATIONS;

if (!migrationsUrl) {
  throw new Error("DATABASE_URL_MIGRATIONS is required for Drizzle tooling.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: migrationsUrl },
});

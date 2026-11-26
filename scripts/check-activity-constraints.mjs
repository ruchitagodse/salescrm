import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { parseIndiaDateTime } from "../src/lib/activity-time.ts";

// Admin runtime check: synthetic fixtures only, always rolled back. No existing
// business rows are edited and no env values/raw errors/fixture IDs are printed.
config({ path: ".env.local", quiet: true });
function codes(error) {
  const result = [];
  for (let cause = error, depth = 0; cause && depth < 4; cause = cause.cause, depth++) {
    if (typeof cause.code === "string" && /^[A-Z0-9_]{1,40}$/.test(cause.code)) result.push(cause.code);
  }
  return result;
}
class RollbackVerification extends Error {}
let client;
let contactId;
let activityId;
const checks = [];
try {
  if (!process.env.DATABASE_URL) throw new Error();
  client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 8 });
  const db = drizzle(client);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local statement_timeout = '5s'`);
      const [contact] = await tx.execute(sql`insert into public.contacts(full_name,instagram_handle)
        values ('OS verification - rollback fixture','os_rollback_verification') returning id`);
      contactId = contact.id;
      const due = parseIndiaDateTime("2026-11-25T09:30").toISOString();
      const [activity] = await tx.execute(sql`insert into public.activities(title,type,due_at,contact_id,updated_at)
        values ('OS verification - rollback fixture','follow_up',${due}::timestamptz,${contactId},'2000-01-01T00:00:00Z')
        returning id, due_at=${due}::timestamptz as correct_due, status='planned' as default_status`);
      activityId = activity.id;
      if (!activity.correct_due || !activity.default_status) throw new Error();
      checks.push("uuid_defaults_and_india_due_time");
      const reject = async (name, code, operation) => {
        let rejected = false;
        try { await tx.transaction(operation); }
        catch (error) { rejected = codes(error).includes(code); }
        if (!rejected) throw new Error();
        checks.push(name);
      };
      await reject("one_target_required", "23514", (test) => test.execute(sql`update public.activities set contact_id=null where id=${activityId}`));
      await reject("two_targets_rejected", "23514", (test) => test.execute(sql`update public.activities set lead_id=${contactId} where id=${activityId}`));
      await reject("invalid_type_rejected", "23514", (test) => test.execute(sql`update public.activities set type='invalid' where id=${activityId}`));
      await reject("invalid_status_rejected", "23514", (test) => test.execute(sql`update public.activities set status='invalid' where id=${activityId}`));
      await reject("blank_title_rejected", "23514", (test) => test.execute(sql`update public.activities set title=' ' where id=${activityId}`));
      await reject("due_time_required", "23502", (test) => test.execute(sql`update public.activities set due_at=null where id=${activityId}`));
      await reject("completion_time_required", "23514", (test) => test.execute(sql`update public.activities set status='completed' where id=${activityId}`));
      const [completed] = await tx.execute(sql`update public.activities set status='completed',completed_at=now() where id=${activityId}
        returning completed_at is not null and updated_at > '2000-01-01T00:00:00Z'::timestamptz as valid`);
      if (!completed.valid) throw new Error();
      checks.push("completed_transition_and_updated_at_trigger");
      await reject("reopen_requires_clearing_completion", "23514", (test) => test.execute(sql`update public.activities set status='planned' where id=${activityId}`));
      await tx.execute(sql`update public.activities set status='planned',completed_at=null where id=${activityId}`);
      checks.push("reopen_transition");
      await reject("parent_delete_restricted", "23503", (test) => test.execute(sql`delete from public.contacts where id=${contactId}`));
      await tx.execute(sql`update public.activities set deleted_at=now() where id=${activityId}`);
      const [hidden] = await tx.execute(sql`select not exists(select 1 from public.activities where id=${activityId} and deleted_at is null) as valid`);
      if (!hidden.valid) throw new Error();
      checks.push("soft_delete_filter");
      throw new RollbackVerification();
    });
  } catch (error) { if (!(error instanceof RollbackVerification)) throw error; }
  const [rollback] = await db.execute(sql`select
    not exists(select 1 from public.contacts where id=${contactId})
    and not exists(select 1 from public.activities where id=${activityId}) as verified`);
  if (!rollback.verified) throw new Error();
  console.log(JSON.stringify({ passed: true, checks, rollbackVerified: true, persistedFixtures: false }));
} catch (error) {
  console.error(JSON.stringify({ passed: false, codes: codes(error), rawDetails: "suppressed" }));
  process.exitCode = 1;
} finally { if (client) await client.end({ timeout: 1 }); }

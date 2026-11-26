import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
config({ path: ".env.local", quiet: true });
// Synthetic fixtures, always rolled back. Explicit random positive references
// avoid consuming the public document sequences. No existing rows are edited.
class RollbackCheck extends Error {}
const checks = [];
const codes = (error) => {
  const values = [];
  for (let cause = error, i = 0; cause && i < 4; cause = cause.cause, i++) {
    if (typeof cause.code === "string" && /^[A-Z0-9_]{1,40}$/.test(cause.code)) values.push(cause.code);
  }
  return values;
};
let client, contactId, quoteId, orderId, paymentId, expenseId;
let step = "connect";
try {
  if (!process.env.DATABASE_URL) throw new Error();
  client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 8 });
  const db = drizzle(client);
  const number = BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 15)}`) + BigInt(1);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local statement_timeout='8s'`);
      const reject = async (name, code, operation) => {
        step = name; let rejected = false;
        try { await tx.transaction(operation); } catch (error) { rejected = codes(error).includes(code); }
        if (!rejected) throw new Error(); checks.push(name);
      };
      step = "fixtures";
      const [contact] = await tx.execute(sql`insert into public.contacts(full_name,instagram_handle) values ('OS rollback verification','os_financial_rollback') returning id`);
      contactId = contact.id;
      const [lead] = await tx.execute(sql`insert into public.leads(contact_id,source) values (${contactId},'other') returning id`);
      const [stage] = await tx.execute(sql`select id from public.pipeline_stages where key='discovery' and deleted_at is null`);
      const [deal] = await tx.execute(sql`insert into public.deals(title,lead_id,stage_id) values ('OS rollback verification',${lead.id},${stage.id}) returning id`);
      const [quote] = await tx.execute(sql`insert into public.quotations(number,title,deal_id,total_paise) values (${number.toString()}::bigint,'OS rollback verification',${deal.id},100000) returning id`);
      quoteId = quote.id;
      const [line] = await tx.execute(sql`insert into public.quotation_items(quotation_id,description,quantity,unit_price_paise,line_total_paise,position) values (${quoteId},'Service',2,50000,100000,0) returning id`);
      await reject("incorrect_line_math_rejected", "23514", (test) => test.execute(sql`update public.quotation_items set line_total_paise=1 where id=${line.id}`));
      await reject("draft_cannot_skip_sent", "23514", (test) => test.execute(sql`update public.quotations set status='accepted' where id=${quoteId}`));
      await reject("draft_cannot_create_order", "23514", (test) => test.execute(sql`insert into public.orders(number,quotation_id,title,customer_name,total_paise) values (${number.toString()}::bigint,${quoteId},'OS rollback verification','Verification',100000)`));
      await reject("header_item_mismatch_rejected", "23514", async (test) => {
        await test.execute(sql`update public.quotations set total_paise=1 where id=${quoteId}`);
        await test.execute(sql`update public.quotations set status='sent' where id=${quoteId}`);
      });
      await tx.execute(sql`update public.quotations set status='sent' where id=${quoteId}`);
      await reject("sent_header_is_frozen", "23514", (test) => test.execute(sql`update public.quotations set title='Changed' where id=${quoteId}`));
      await reject("sent_items_are_frozen", "23514", (test) => test.execute(sql`update public.quotation_items set description='Changed' where id=${line.id}`));
      await tx.execute(sql`update public.quotations set status='accepted' where id=${quoteId}`);
      step = "accepted_snapshot";
      const [order] = await tx.execute(sql`insert into public.orders(number,quotation_id,title,customer_name,total_paise) values (${number.toString()}::bigint,${quoteId},'OS rollback verification','Verification',100000) returning id`);
      orderId = order.id;
      const [orderLine] = await tx.execute(sql`insert into public.order_items(order_id,description,quantity,unit_price_paise,line_total_paise,position) values (${orderId},'Service',2,50000,100000,0) returning id`);
      await tx.execute(sql`set constraints all immediate`);
      checks.push("accepted_order_snapshot_complete");
      await reject("one_order_per_quote", "23505", (test) => test.execute(sql`insert into public.orders(number,quotation_id,title,customer_name,total_paise) values (${(number+BigInt(2)).toString()}::bigint,${quoteId},'OS rollback verification','Verification',100000)`));
      await reject("order_header_immutable", "23514", (test) => test.execute(sql`update public.orders set total_paise=1 where id=${orderId}`));
      await reject("order_items_immutable", "23514", (test) => test.execute(sql`update public.order_items set unit_price_paise=1 where id=${orderLine.id}`));
      await reject("incomplete_order_rejected_at_constraint_check", "23514", async (test) => {
        await test.execute(sql`set constraints all deferred`);
        const [other] = await test.execute(sql`insert into public.quotations(number,title,deal_id,total_paise) values (${(number+BigInt(1)).toString()}::bigint,'OS rollback incomplete',${deal.id},100000) returning id`);
        await test.execute(sql`insert into public.quotation_items(quotation_id,description,quantity,unit_price_paise,line_total_paise,position) values (${other.id},'Service',2,50000,100000,0)`);
        await test.execute(sql`update public.quotations set status='sent' where id=${other.id}`);
        await test.execute(sql`update public.quotations set status='accepted' where id=${other.id}`);
        await test.execute(sql`insert into public.orders(number,quotation_id,title,customer_name,total_paise) values (${(number+BigInt(1)).toString()}::bigint,${other.id},'OS rollback incomplete','Verification',100000)`);
        await test.execute(sql`set constraints all immediate`);
      });
      step = "partial_receipt";
      const [payment] = await tx.execute(sql`insert into public.payments(order_id,amount_paise,paid_on,updated_at) values (${orderId},60000,'2026-11-25','2000-01-01T00:00Z') returning id`);
      paymentId = payment.id;
      await reject("overpayment_rejected", "23514", (test) => test.execute(sql`insert into public.payments(order_id,amount_paise,paid_on) values (${orderId},50000,'2026-11-25')`));
      await tx.execute(sql`insert into public.payments(order_id,amount_paise,paid_on) values (${orderId},40000,'2026-11-25')`);
      const [settlement] = await tx.execute(sql`select sum(amount_paise)=100000 as valid from public.payments where order_id=${orderId} and status='recorded'`);
      if (!settlement.valid) throw new Error(); checks.push("partial_payments_settle_exactly");
      await reject("paid_order_rejects_extra_receipt", "23514", (test) => test.execute(sql`insert into public.payments(order_id,amount_paise,paid_on) values (${orderId},1,'2026-11-25')`));
      await reject("receipt_amount_immutable", "23514", (test) => test.execute(sql`update public.payments set amount_paise=1 where id=${paymentId}`));
      await reject("receipt_requires_void_reason", "23514", (test) => test.execute(sql`update public.payments set status='voided',voided_at=now() where id=${paymentId}`));
      await tx.execute(sql`update public.payments set status='voided',voided_at=now(),void_reason='Verification correction' where id=${paymentId}`);
      const [voided] = await tx.execute(sql`select (select sum(amount_paise) from public.payments where order_id=${orderId} and status='recorded')=40000
        and exists(select 1 from public.payments where id=${paymentId} and amount_paise=60000 and updated_at>'2000-01-01T00:00Z'::timestamptz) as valid`);
      if (!voided.valid) throw new Error(); checks.push("void_preserves_history_restores_balance_and_updates_timestamp");
      await reject("receipt_deletion_forbidden", "23514", (test) => test.execute(sql`delete from public.payments where id=${paymentId}`));
      await reject("voided_receipt_cannot_be_rewritten", "23514", (test) => test.execute(sql`update public.payments set void_reason='Changed' where id=${paymentId}`));
      await reject("zero_expense_rejected", "23514", (test) => test.execute(sql`insert into public.expenses(spent_on,payee,category,amount_paise) values ('2026-11-25','Verification','Tools',0)`));
      step = "expense";
      const [expense] = await tx.execute(sql`insert into public.expenses(spent_on,payee,category,amount_paise) values ('2026-11-25','Verification','Tools',30000) returning id`);
      expenseId = expense.id;
      await reject("expense_amount_immutable", "23514", (test) => test.execute(sql`update public.expenses set amount_paise=1 where id=${expenseId}`));
      await reject("expense_void_reason_required", "23514", (test) => test.execute(sql`update public.expenses set status='voided',voided_at=now() where id=${expenseId}`));
      await tx.execute(sql`update public.expenses set status='voided',voided_at=now(),void_reason='Verification correction' where id=${expenseId}`);
      await reject("expense_deletion_forbidden", "23514", (test) => test.execute(sql`delete from public.expenses where id=${expenseId}`));
      checks.push("expense_void_retains_original_record");
      await tx.execute(sql`set constraints all immediate`);
      throw new RollbackCheck();
    });
  } catch (error) { if (!(error instanceof RollbackCheck)) throw error; }
  step = "rollback";
  const [rollback] = await db.execute(sql`select
    not exists(select 1 from public.contacts where id=${contactId}) and not exists(select 1 from public.quotations where id=${quoteId})
    and not exists(select 1 from public.orders where id=${orderId}) and not exists(select 1 from public.payments where id=${paymentId})
    and not exists(select 1 from public.expenses where id=${expenseId}) as valid`);
  if (!rollback.valid) throw new Error();
  console.log(JSON.stringify({ passed: true, checks, rollbackVerified: true, persistedFixtures: false }));
} catch (error) { console.error(JSON.stringify({ passed: false, step, codes: codes(error), rawDetails: "suppressed" })); process.exitCode = 1; }
finally { if (client) await client.end({ timeout: 1 }); }

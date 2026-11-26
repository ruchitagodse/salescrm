import "server-only";
import { asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { contacts, deals, expenses, leads, orderItems, orders, payments, quotationItems, quotations } from "@/db/schema";
import { expenseInputSchema, financeListSchema, paymentInputSchema, quotationInputSchema, quotationStatusSchema, voidInputSchema } from "@/lib/finance-validation";
import { calculateItems, canChangeQuotation, documentReference, receiptFits } from "@/lib/finance-values";
import { entityIdSchema } from "@/lib/validation";
import { all, DataError, found, searchPattern, validate, withData, type Transaction } from "./shared";

type Serialized<T> = { [K in keyof T]: T[K] extends bigint ? string : T[K] extends bigint | null ? string | null : T[K] };
function dto<T extends object>(row: T): Serialized<T> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])) as Serialized<T>;
}
function calculated(items: Parameters<typeof calculateItems>[0]) {
  try { return calculateItems(items); } catch { throw new DataError("INVALID_INPUT"); }
}
async function liveDeal(tx: Transaction, id: string) {
  const [row] = await tx.select({ id: deals.id }).from(deals).where(all(eq(deals.id, id), isNull(deals.deletedAt))).for("update");
  if (!row) throw new DataError("INVALID_REFERENCE");
}
async function paid(tx: Transaction, id: string) {
  const [row] = await tx.select({ amount: sql<string>`coalesce(sum(${payments.amountPaise}),0)::text` }).from(payments)
    .where(all(eq(payments.orderId, id), eq(payments.status, "recorded"), isNull(payments.deletedAt)));
  return BigInt(row.amount);
}
export async function financeReady() {
  return withData(async (db) => {
    const [row] = await db.execute<{ ready: boolean }>(sql`select
      (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('quotations','quotation_items','orders','order_items','payments','expenses') and c.relkind='r' and c.relrowsecurity)=6
      and not exists(select 1 from pg_policies where schemaname='public' and tablename in ('quotations','quotation_items','orders','order_items','payments','expenses')) as ready`);
    return row.ready;
  });
}
export async function saveQuotation(id: string | null, input: unknown) {
  return withData(async (db) => {
    if (id !== null) validate(entityIdSchema, id);
    const values = validate(quotationInputSchema, input);
    const totals = calculated(values.items);
    return db.transaction(async (tx) => {
      let row: typeof quotations.$inferSelect;
      if (id) {
        const [current] = await tx.select().from(quotations).where(all(eq(quotations.id, id), isNull(quotations.deletedAt))).for("update");
        if (found(current).status !== "draft") throw new DataError("INVALID_STATE");
        if (current.dealId !== values.dealId) await liveDeal(tx, values.dealId);
        const [updated] = await tx.update(quotations).set({ title: values.title, dealId: values.dealId, notes: values.notes, totalPaise: totals.totalPaise })
          .where(eq(quotations.id, id)).returning();
        row = found(updated);
        await tx.update(quotationItems).set({ deletedAt: new Date() }).where(all(eq(quotationItems.quotationId, id), isNull(quotationItems.deletedAt)));
      } else {
        await liveDeal(tx, values.dealId);
        const [created] = await tx.insert(quotations).values({ title: values.title, dealId: values.dealId, notes: values.notes, totalPaise: totals.totalPaise }).returning();
        row = found(created);
      }
      await tx.insert(quotationItems).values(totals.lines.map((line) => ({ ...line, quotationId: row.id })));
      return { ...dto(row), reference: documentReference("Q", row.number) };
    });
  });
}
export async function changeQuotationStatus(id: string, status: unknown) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    const next = validate(quotationStatusSchema, status);
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(quotations).where(all(eq(quotations.id, id), isNull(quotations.deletedAt))).for("update");
      const current = found(row);
      if (!canChangeQuotation(current.status, next)) throw new DataError("INVALID_STATE");
      const items = await tx.select().from(quotationItems).where(all(eq(quotationItems.quotationId, id), isNull(quotationItems.deletedAt)));
      if (calculated(items).totalPaise !== current.totalPaise) throw new DataError("INVALID_STATE");
      const [updated] = await tx.update(quotations).set({ status: next }).where(eq(quotations.id, id)).returning();
      return dto(found(updated));
    });
  });
}
export async function softDeleteQuotation(id: string) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    const [row] = await db.update(quotations).set({ deletedAt: new Date() })
      .where(all(eq(quotations.id, id), eq(quotations.status, "draft"), isNull(quotations.deletedAt))).returning({ id: quotations.id });
    if (!row) throw new DataError("INVALID_STATE");
    return row;
  });
}
export async function convertQuotationToOrder(id: string) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(quotations).where(all(eq(quotations.id, id), isNull(quotations.deletedAt))).for("update");
      const quote = found(row);
      if (quote.status !== "accepted") throw new DataError("INVALID_STATE");
      const [existing] = await tx.select().from(orders).where(eq(orders.quotationId, id));
      if (existing) {
        if (existing.deletedAt) throw new DataError("CONFLICT");
        return { ...dto(existing), reference: documentReference("O", existing.number) };
      }
      const items = await tx.select().from(quotationItems).where(all(eq(quotationItems.quotationId, id), isNull(quotationItems.deletedAt))).orderBy(asc(quotationItems.position));
      const snapshot = calculated(items);
      if (snapshot.totalPaise !== quote.totalPaise) throw new DataError("INVALID_STATE");
      const [customer] = await tx.select({ name: contacts.fullName }).from(deals).innerJoin(leads, eq(deals.leadId, leads.id))
        .innerJoin(contacts, eq(leads.contactId, contacts.id)).where(eq(deals.id, quote.dealId));
      const [order] = await tx.insert(orders).values({ quotationId: id, title: quote.title, customerName: found(customer).name, totalPaise: snapshot.totalPaise, notes: quote.notes }).returning();
      await tx.insert(orderItems).values(snapshot.lines.map((line) => ({ description: line.description, quantity: line.quantity, unitPricePaise: line.unitPricePaise, lineTotalPaise: line.lineTotalPaise, position: line.position, orderId: order.id })));
      return { ...dto(order), reference: documentReference("O", order.number) };
    });
  });
}
export async function getQuotation(id: string) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    const [row] = await db.select().from(quotations).where(all(eq(quotations.id, id), isNull(quotations.deletedAt)));
    const quote = found(row);
    const items = await db.select().from(quotationItems).where(all(eq(quotationItems.quotationId, id), isNull(quotationItems.deletedAt))).orderBy(asc(quotationItems.position));
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.quotationId, id));
    return { ...dto(quote), reference: documentReference("Q", quote.number), items: items.map(dto), orderId: order?.id ?? null };
  });
}
export async function getOrder(id: string) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    const [row] = await db.select().from(orders).where(all(eq(orders.id, id), isNull(orders.deletedAt)));
    const order = found(row);
    const items = await db.select().from(orderItems).where(all(eq(orderItems.orderId, id), isNull(orderItems.deletedAt))).orderBy(asc(orderItems.position));
    const receipts = await db.select().from(payments).where(all(eq(payments.orderId, id), isNull(payments.deletedAt))).orderBy(desc(payments.createdAt));
    const paidPaise = receipts.filter((p) => p.status === "recorded").reduce((sum, p) => sum + p.amountPaise, BigInt(0));
    return { ...dto(order), reference: documentReference("O", order.number), items: items.map(dto), payments: receipts.map(dto),
      paidPaise: paidPaise.toString(), balancePaise: (order.totalPaise - paidPaise).toString(), paymentState: paidPaise === order.totalPaise ? "paid" : paidPaise === BigInt(0) ? "unpaid" : "partial" };
  });
}
export async function recordPayment(input: unknown) {
  return withData(async (db) => {
    const values = validate(paymentInputSchema, input);
    return db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(all(eq(orders.id, values.orderId), isNull(orders.deletedAt))).for("update");
      const order = found(row);
      if (!receiptFits(order.totalPaise, await paid(tx, order.id), values.amountPaise)) throw new DataError("OVERPAYMENT");
      const [receipt] = await tx.insert(payments).values(values).returning();
      return dto(found(receipt));
    });
  });
}
export async function recordExpense(input: unknown) {
  return withData(async (db) => {
    const values = validate(expenseInputSchema, input);
    const [row] = await db.insert(expenses).values(values).returning();
    return dto(found(row));
  });
}
export async function voidFinancialRecord(kind: "payments" | "expenses", id: string, input: unknown) {
  return withData(async (db) => {
    validate(entityIdSchema, id);
    const { reason } = validate(voidInputSchema, input);
    return db.transaction(async (tx) => {
      if (kind === "payments") {
        const [initial] = await tx.select().from(payments).where(all(eq(payments.id, id), isNull(payments.deletedAt)));
        const receipt = found(initial);
        await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, receipt.orderId)).for("update");
        const [row] = await tx.select().from(payments).where(eq(payments.id, id)).for("update");
        if (row.status === "voided") return dto(row);
        const [updated] = await tx.update(payments).set({ status: "voided", voidReason: reason, voidedAt: new Date() }).where(eq(payments.id, id)).returning();
        return dto(found(updated));
      }
      if (kind !== "expenses") throw new DataError("INVALID_INPUT");
      const [row] = await tx.select().from(expenses).where(all(eq(expenses.id, id), isNull(expenses.deletedAt))).for("update");
      const current = found(row);
      if (current.status === "voided") return dto(current);
      const [updated] = await tx.update(expenses).set({ status: "voided", voidReason: reason, voidedAt: new Date() }).where(eq(expenses.id, id)).returning();
      return dto(found(updated));
    });
  });
}
export async function getPayment(id: string) {
  return withData(async (db) => { validate(entityIdSchema, id); const [row] = await db.select().from(payments).where(all(eq(payments.id, id), isNull(payments.deletedAt))); return dto(found(row)); });
}
export async function getExpense(id: string) {
  return withData(async (db) => { validate(entityIdSchema, id); const [row] = await db.select().from(expenses).where(all(eq(expenses.id, id), isNull(expenses.deletedAt))); return dto(found(row)); });
}
export async function listQuotations(input: unknown = {}) {
  return withData(async (db) => {
    const { search, page, pageSize } = validate(financeListSchema, input);
    const ref = sql`concat('Q-',lpad(${quotations.number}::text,greatest(6,length(${quotations.number}::text)),'0'))`;
    const where = all(isNull(quotations.deletedAt), search ? or(ilike(quotations.title, searchPattern(search)), ilike(ref, searchPattern(search))) : undefined);
    const items = await db.select().from(quotations).where(where).orderBy(desc(quotations.createdAt), desc(quotations.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(quotations).where(where);
    return { items: items.map((row) => ({ ...dto(row), reference: documentReference("Q", row.number) })), total: total.value, page, pageSize };
  });
}
export async function listOrders(input: unknown = {}) {
  return withData(async (db) => {
    const { search, page, pageSize } = validate(financeListSchema, input);
    const ref = sql`concat('O-',lpad(${orders.number}::text,greatest(6,length(${orders.number}::text)),'0'))`;
    const where = all(isNull(orders.deletedAt), search ? or(ilike(orders.title, searchPattern(search)), ilike(orders.customerName, searchPattern(search)), ilike(ref, searchPattern(search))) : undefined);
    const items = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(orders).where(where);
    return { items: items.map((row) => ({ ...dto(row), reference: documentReference("O", row.number) })), total: total.value, page, pageSize };
  });
}
export async function listPayments(input: unknown = {}) {
  return withData(async (db) => {
    const { search, page, pageSize } = validate(financeListSchema, input);
    const ref = sql`concat('O-',lpad(${orders.number}::text,greatest(6,length(${orders.number}::text)),'0'))`;
    const where = all(isNull(payments.deletedAt), search ? or(ilike(payments.reference, searchPattern(search)), ilike(payments.method, searchPattern(search)), ilike(ref, searchPattern(search))) : undefined);
    const items = await db.select({ payment: payments, orderNumber: orders.number }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).where(where).orderBy(desc(payments.createdAt), desc(payments.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(payments).innerJoin(orders, eq(payments.orderId, orders.id)).where(where);
    return { items: items.map((row) => ({ ...dto(row.payment), orderReference: documentReference("O", row.orderNumber) })), total: total.value, page, pageSize };
  });
}
export async function listExpenses(input: unknown = {}) {
  return withData(async (db) => {
    const { search, page, pageSize } = validate(financeListSchema, input);
    const where = all(isNull(expenses.deletedAt), search ? or(ilike(expenses.payee, searchPattern(search)), ilike(expenses.category, searchPattern(search))) : undefined);
    const items = await db.select().from(expenses).where(where).orderBy(desc(expenses.createdAt), desc(expenses.id)).limit(pageSize).offset((page - 1) * pageSize);
    const [total] = await db.select({ value: count() }).from(expenses).where(where);
    return { items: items.map(dto), total: total.value, page, pageSize };
  });
}

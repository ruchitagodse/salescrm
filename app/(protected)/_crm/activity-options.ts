import "server-only";
import { requireUser } from "@/lib/auth";
import { listContacts, listDeals, listLeads } from "@/lib/data";
import type { ActivityOptions } from "./activity-form";

async function collect<T>(load: (page: number) => Promise<{ items: T[]; total: number }>): Promise<T[]> {
  const first = await load(1);
  const items = [...first.items];
  for (let page = 2; (page - 1) * 100 < first.total; page++) items.push(...(await load(page)).items);
  return items;
}
export async function activityOptions(): Promise<ActivityOptions> {
  await requireUser();
  const [contact, lead, deal] = await Promise.all([
    collect((page) => listContacts({ page, pageSize: 100 })),
    collect((page) => listLeads({ page, pageSize: 100 })),
    collect((page) => listDeals({ page, pageSize: 100 })),
  ]);
  return {
    contact: contact.map((row) => ({ value: row.id, label: row.fullName })),
    lead: lead.map((row) => ({ value: row.id, label: `${row.contactName}: ${row.serviceNeeds || row.sourceDetail || row.source}` })),
    deal: deal.map((row) => ({ value: row.id, label: row.title })),
  };
}

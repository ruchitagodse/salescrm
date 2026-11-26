import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, check, uniqueIndex, index } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, deletedAt } from "./columns";
import { leads } from "./leads";
export const integrationEvents = pgTable("integration_events",{
  id:id(), channel:text("channel").notNull(),accountId:text("account_id").notNull(),externalId:text("external_id").notNull(),
  senderId:text("sender_id"),occurredAt:timestamp("occurred_at",{withTimezone:true}).notNull(),kind:text("kind").notNull(),
  body:text("body"),displayName:text("display_name"),formId:text("form_id"),adId:text("ad_id"),
  state:text("state").notNull().default("received"),errorCode:text("error_code"),
  leadId:uuid("lead_id").references(()=>leads.id,{onDelete:"restrict"}),
  createdAt:createdAt(),updatedAt:updatedAt(),deletedAt:deletedAt(),
},t=>[
  uniqueIndex("integration_events_provider_unique").on(t.channel,t.accountId,t.externalId),
  check("integration_events_channel_check",sql`${t.channel} in ('meta_ads','instagram','whatsapp')`),
  check("integration_events_state_check",sql`${t.state} in ('received','processed','needs_review')`),
  check("integration_events_processed_check",sql`(${t.state}='processed' and ${t.leadId} is not null and ${t.errorCode} is null) or (${t.state}<>'processed' and ${t.leadId} is null)`),
  check("integration_events_body_check",sql`${t.body} is null or length(${t.body})<=10000`),
  index("integration_events_state_created_idx").on(t.state,t.createdAt),index("integration_events_lead_idx").on(t.leadId),
]).enableRLS();
export const integrationIdentities = pgTable("integration_identities",{
  id:id(),channel:text("channel").notNull(),accountId:text("account_id").notNull(),senderId:text("sender_id").notNull(),
  leadId:uuid("lead_id").notNull().references(()=>leads.id,{onDelete:"restrict"}),
  createdAt:createdAt(),updatedAt:updatedAt(),deletedAt:deletedAt(),
},t=>[
  uniqueIndex("integration_identities_provider_unique").on(t.channel,t.accountId,t.senderId),
  check("integration_identities_channel_check",sql`${t.channel} in ('instagram','whatsapp')`),
]).enableRLS();

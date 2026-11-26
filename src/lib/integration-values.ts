import { z } from "zod";
export const CHANNELS = ["meta_ads", "instagram", "whatsapp"] as const;
export type Channel = typeof CHANNELS[number];
const identifier = z.string().min(1).max(512).regex(/^[A-Za-z0-9_.:=+\/-]+$/);
export const eventSchema = z.object({
  channel: z.enum(CHANNELS), accountId: identifier, externalId: identifier,
  senderId: identifier.nullable(), occurredAt: z.coerce.date(), kind: z.string().min(1).max(80),
  body: z.string().max(10000).nullable(), displayName: z.string().max(300).nullable(),
  formId: identifier.nullable(), adId: identifier.nullable(),
}).strict();
export type InboundEvent = z.output<typeof eventSchema>;
const object = z.object({}).catchall(z.unknown());
const record = (value: unknown) => object.parse(value);
const array = (value: unknown): unknown[] => value === undefined ? [] : z.array(z.unknown()).max(1000).parse(value);
const id = (value: unknown) => identifier.parse(value);
const text = (value: unknown, max: number) => value === undefined || value === null ? null : z.string().max(max).parse(value);
const instant = (value: unknown, milliseconds = false) => {
  const n = z.coerce.number().finite().min(0).parse(value);
  return z.date().parse(new Date(milliseconds ? n : n * 1000));
};
// Pure parser: call only after HMAC verification. Unknown non-intake fields are ignored.
export function parseInbound(channel: Channel, payload: unknown, accountId: string): InboundEvent[] {
  const root = record(payload); const result: InboundEvent[] = [];
  const expected = { meta_ads: "page", instagram: "instagram", whatsapp: "whatsapp_business_account" }[channel];
  if (root.object !== expected) throw new Error("Invalid event object");
  for (const raw of array(root.entry)) {
    const entry = record(raw);
    if (channel === "instagram") {
      if (id(entry.id) !== accountId) throw new Error("Account mismatch");
      for (const rawMessage of array(entry.messaging)) {
        const m = record(rawMessage); if (!m.message) continue;
        const message = record(m.message); if (message.is_echo === true || message.is_deleted === true || message.is_unsupported === true) continue;
        const sender = id(record(m.sender).id); if (sender === accountId) continue;
        if (id(record(m.recipient).id) !== accountId) throw new Error("Recipient mismatch");
        result.push(eventSchema.parse({ channel, accountId, externalId: id(message.mid), senderId: sender,
          occurredAt: instant(m.timestamp, true), kind: message.text === undefined ? "attachment" : "text",
          body: text(message.text, 10000), displayName: null, formId: null, adId: null }));
      }
    } else for (const rawChange of array(entry.changes)) {
      const change = record(rawChange);
      if (channel === "meta_ads") {
        if (id(entry.id) !== accountId) throw new Error("Account mismatch");
        if (change.field !== "leadgen") continue;
        const v = record(change.value); if (id(v.page_id) !== accountId) throw new Error("Page mismatch");
        result.push(eventSchema.parse({channel,accountId,externalId:id(v.leadgen_id),senderId:null,occurredAt:instant(v.created_time),kind:"lead_form",body:null,displayName:null,formId:id(v.form_id),adId:v.ad_id ? id(v.ad_id) : null}));
      } else {
        if (change.field !== "messages") continue;
        const v = record(change.value); if (id(record(v.metadata).phone_number_id) !== accountId) throw new Error("Account mismatch");
        for (const rawMessage of array(v.messages)) {
          const m = record(rawMessage); const sender = id(m.from);
          const person = array(v.contacts).map(record).find(c => c.wa_id === sender);
          const kind = z.string().min(1).max(80).parse(m.type);
          // System/unsupported notifications are not customer enquiries.
          if (kind === "system" || kind === "unsupported") continue;
          result.push(eventSchema.parse({channel,accountId,externalId:id(m.id),senderId:sender,occurredAt:instant(m.timestamp),kind,
            body:kind === "text" ? text(record(m.text).body,10000) : null,
            displayName:person?.profile ? text(record(person.profile).name,300) : null,formId:null,adId:null}));
        }
      }
      if (result.length > 1000) throw new Error("Too many events");
    }
    if (result.length > 1000) throw new Error("Too many events");
  }
  return result;
}

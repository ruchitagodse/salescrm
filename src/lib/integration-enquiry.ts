import { z } from "zod";
import type { InboundEvent } from "./integration-values.ts";
import { createLeadWithContactSchema } from "./validation.ts";
import { normalizePhone } from "./normalize.ts";
export function providerEnquiry(event:InboundEvent,details:unknown=null){
  let contact: {fullName:string;phone?:string;email?:string;instagramHandle?:string;city?:string};
  let requirement=event.body ?? `Inbound ${event.channel} ${event.kind}`;
  if(event.channel==='meta_ads'){
    const result=z.object({id:z.string(),form_id:z.string(),field_data:z.array(z.object({name:z.string(),values:z.array(z.string().max(10000)).max(100)})).max(100)}).parse(details);
    if(result.id!==event.externalId || result.form_id!==event.formId)throw new RangeError('Mismatched lead');
    const fields=new Map(result.field_data.map(f=>[f.name,f.values[0]?.trim()]));
    const name=fields.get('full_name') || [fields.get('first_name'),fields.get('last_name')].filter(Boolean).join(' ');
    contact={fullName:name || 'Meta lead enquiry',phone:fields.get('phone_number') || undefined,email:fields.get('email') || undefined,city:fields.get('city') || undefined};
    requirement=fields.get('requirement') || 'Meta lead form enquiry';
  }else if(event.channel==='instagram'){
    const profile=z.object({username:z.string().regex(/^[A-Za-z0-9._]{1,30}$/),name:z.string().max(300).nullable().optional()}).parse(details);
    contact={fullName:profile.name?.trim() || profile.username,instagramHandle:profile.username};
  }else{
    if(!event.senderId || !/^\d{5,15}$/.test(event.senderId))throw new RangeError('Unsupported identity');
    const phone=normalizePhone(`+${event.senderId}`);
    contact={fullName:event.displayName?.trim() || 'WhatsApp enquiry',phone:phone ?? undefined};
  }
  return createLeadWithContactSchema.parse({contact,lead:{source:event.channel,entryMethod:'integration',requirement,
    sourceDetail:`${event.channel}; account=${event.accountId}; event=${event.externalId}${event.formId?`; form=${event.formId}`:''}${event.adId?`; ad=${event.adId}`:''}`}});
}

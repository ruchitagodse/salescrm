import "server-only";
import { and, eq, isNull, desc, count, sql, inArray } from "drizzle-orm";
import { integrationEvents as events, integrationIdentities as identities, leads, contacts } from "@/db/schema";
import { eventSchema, type InboundEvent } from "@/lib/integration-values";
import { enquiryForEvent, IntakeError } from "@/lib/integrations/graph";
import { integrationConfig } from "@/lib/integrations/config";
import { createEnquiryInTransaction } from "./leads";
import { withData, DataError, found, validate } from "./shared";
import { entityIdSchema } from "@/lib/validation";
import { ContactMatchConflict } from "@/lib/contact-merge";

const scope=(event:InboundEvent)=>and(eq(identities.channel,event.channel),eq(identities.accountId,event.accountId),eq(identities.senderId,event.senderId ?? ''));
export async function storeInbound(input: InboundEvent[]) {
  const values=input.map(value=>validate(eventSchema,value)); if(!values.length)return [];
  if(values.length>1000 || values.some(e=>e.channel!==values[0].channel || e.accountId!==values[0].accountId))throw new DataError('INVALID_INPUT');
  return withData(async db=>{
    // Whole bounded batch is durable before processing. Conflicts never replace original content.
    await db.insert(events).values(values).onConflictDoNothing({target:[events.channel,events.accountId,events.externalId]});
    const first=values[0];
    // Archived keys still block INSERT, but are acknowledged without reprocessing.
    return db.select({id:events.id,state:events.state,errorCode:events.errorCode}).from(events).where(and(isNull(events.deletedAt),eq(events.channel,first.channel),eq(events.accountId,first.accountId),inArray(events.externalId,values.map(e=>e.externalId))));
  });
}
export async function processIntegrationEvent(eventId:string) {
  const id=validate(entityIdSchema,eventId);
  return withData(async db=>{
    const [initial]=await db.select().from(events).where(and(eq(events.id,id),isNull(events.deletedAt)));
    const event=found(initial); if(event.state==='processed')return {processed:true,retryable:false};
    const input=eventSchema.parse({channel:event.channel,accountId:event.accountId,externalId:event.externalId,senderId:event.senderId,occurredAt:event.occurredAt,kind:event.kind,body:event.body,displayName:event.displayName,formId:event.formId,adId:event.adId});
    try {
      let config;try{config=integrationConfig(input.channel);}catch{throw new IntakeError('CONFIGURATION');}
      if(config.accountId!==input.accountId)throw new IntakeError('CONFIGURATION');
      const [known]=input.channel==='meta_ads'?[]:await db.select().from(identities).where(scope(input));
      const enquiry=known?null:await enquiryForEvent(input);
      await db.transaction(async tx=>{
        const [locked]=await tx.select().from(events).where(and(eq(events.id,id),isNull(events.deletedAt))).for('update');
        if(!locked)throw new DataError('NOT_FOUND');if(locked.state==='processed')return;
        // Serialize first messages by identity across different event IDs/requests.
        if(input.senderId)await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['intake',input.channel,input.accountId,input.senderId])},0))`);
        const [identity]=input.channel==='meta_ads'?[]:await tx.select().from(identities).where(scope(input));
        let leadId:string;
        if(identity){
          const [live]=await tx.select({id:leads.id}).from(leads).innerJoin(contacts,eq(contacts.id,leads.contactId))
            .where(and(eq(leads.id,identity.leadId),isNull(leads.deletedAt),isNull(contacts.deletedAt)));
          if(identity.deletedAt || !live)throw new IntakeError('ARCHIVED_IDENTITY');leadId=live.id;
        }else{
          if(!enquiry)throw new DataError('RETRY');
          const result=await createEnquiryInTransaction(tx,enquiry);leadId=result.lead.id;
          if(input.senderId)await tx.insert(identities).values({channel:input.channel,accountId:input.accountId,senderId:input.senderId,leadId});
        }
        await tx.update(events).set({state:'processed',leadId,errorCode:null}).where(eq(events.id,id));
      });
      return {processed:true,retryable:false};
    }catch(error){
      const safe=error instanceof IntakeError?error.code:error instanceof DataError?error.code:error instanceof ContactMatchConflict?'IDENTITY_CONFLICT':'PROCESSING_FAILED';
      // A concurrent successful worker wins; never overwrite its success/link.
      await db.update(events).set({state:'needs_review',errorCode:safe}).where(and(eq(events.id,id),isNull(events.deletedAt),sql`${events.state}<>'processed'`));
      return {processed:false,retryable:['GRAPH_UNAVAILABLE','RETRY','DATABASE_ERROR','PROCESSING_FAILED'].includes(safe)};
    }
  });
}
export async function integrationsReady(){return withData(async db=>{
  const [row]=await db.execute<{ready:boolean}>(sql`select to_regclass('public.integration_events') is not null and to_regclass('public.integration_identities') is not null as ready`);return row.ready;
});}
export async function listIntegrationEvents(page:number=1){
  if(!Number.isInteger(page)||page<1||page>1000000)throw new DataError('INVALID_INPUT');
  return withData(async db=>{
    const where=isNull(events.deletedAt);
    const [items,[total]]=await Promise.all([db.select().from(events).where(where).orderBy(desc(events.createdAt),desc(events.id)).limit(25).offset((page-1)*25),db.select({value:count()}).from(events).where(where)]);
    return {items,total:total.value,page,pageSize:25};
  });
}

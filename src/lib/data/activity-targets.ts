import 'server-only';
import {eq,isNull,sql} from 'drizzle-orm';
import {contacts,leads,deals} from '@/db/schema';
import {withData} from './shared';
export async function listActivityTargets(){return withData(db=>db.transaction(async tx=>{
 await tx.execute(sql`set local statement_timeout='8s'`);
 const contact=await tx.select({value:contacts.id,label:contacts.fullName}).from(contacts).where(isNull(contacts.deletedAt)).orderBy(contacts.fullName,contacts.id);
 const leadRows=await tx.select({value:leads.id,name:contacts.fullName,needs:leads.serviceNeeds,detail:leads.sourceDetail,source:leads.source}).from(leads).innerJoin(contacts,eq(contacts.id,leads.contactId)).where(isNull(leads.deletedAt)).orderBy(contacts.fullName,leads.id);
 const lead=leadRows.map(row=>({value:row.value,label:`${row.name}: ${row.needs||row.detail||row.source}`}));
 const deal=await tx.select({value:deals.id,label:deals.title}).from(deals).where(isNull(deals.deletedAt)).orderBy(deals.title,deals.id);
 return {contact,lead,deal};
},{accessMode:'read only'}));}

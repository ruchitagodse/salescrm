import 'server-only';
import {eq,isNull} from 'drizzle-orm';
import {quotations,quotationItems,quotationHistory} from '@/db/schema';
import {all,withData,validate,found,DataError} from './shared';
import {entityIdSchema} from '@/lib/validation';
export async function reviseQuotation(id:string,requestId:string){validate(entityIdSchema,id);validate(entityIdSchema,requestId);return withData(db=>db.transaction(async tx=>{
 const [source]=await tx.select().from(quotations).where(all(eq(quotations.id,id),isNull(quotations.deletedAt))).for('update');const old=found(source);
 if(old.status==='draft')throw new DataError('INVALID_STATE');
 const [existing]=await tx.select({id:quotations.id}).from(quotations).where(eq(quotations.id,requestId));
 if(existing){const [record]=await tx.select({id:quotationHistory.id}).from(quotationHistory).where(all(eq(quotationHistory.quotationId,id),eq(quotationHistory.event,'revision_created'),eq(quotationHistory.detail,requestId)));if(!record)throw new DataError('CONFLICT');return existing;}
 const [newQuote]=await tx.insert(quotations).values({id:requestId,title:old.title,dealId:old.dealId,leadId:old.leadId,description:old.description,
  validUntil:old.validUntil,paymentTerms:old.paymentTerms,discountPaise:old.discountPaise,taxPaise:old.taxPaise,milestones:old.milestones,totalPaise:old.totalPaise,notes:old.notes}).returning({id:quotations.id});
 const items=await tx.select().from(quotationItems).where(all(eq(quotationItems.quotationId,id),isNull(quotationItems.deletedAt)));
 await tx.insert(quotationItems).values(items.map(i=>({quotationId:newQuote.id,description:i.description,quantity:i.quantity,unitPricePaise:i.unitPricePaise,lineTotalPaise:i.lineTotalPaise,position:i.position})));
 await tx.insert(quotationHistory).values([{quotationId:id,event:'revision_created',detail:newQuote.id},{quotationId:newQuote.id,event:'revision_of',detail:id}]);return newQuote;
}));}

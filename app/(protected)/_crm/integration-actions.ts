"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { processIntegrationEvent } from "@/lib/data/integrations";
import { entityIdSchema } from "@/lib/validation";
export type RetryState = {message:string};
export async function retryIntake(_previous:RetryState,data:FormData):Promise<RetryState>{
  await requireUser();
  const id=entityIdSchema.safeParse(data.get('id'));if(!id.success)return {message:'Invalid request.'};
  let message;
  try{const result=await processIntegrationEvent(id.data);message=result.processed?'Processed successfully.':'Still needs review. Check setup or resolve the contact conflict before retrying.';}
  catch{message='Unable to process this event. Please try again.';}
  for(const path of ['/integrations','/leads','/contacts','/analytics'])revalidatePath(path);
  return {message};
}

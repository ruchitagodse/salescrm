import "server-only";
import { integrationConfig } from "./config";
import type { InboundEvent } from "../integration-values";
import { boundedBody } from "../webhook-security";
import { providerEnquiry } from "../integration-enquiry";
export class IntakeError extends Error {
  constructor(public code: "GRAPH_UNAVAILABLE"|"INVALID_CONTACT"|"ARCHIVED_IDENTITY"|"CONFIGURATION") { super("Intake needs review"); }
}
async function graph(channel:'meta_ads'|'instagram',id:string,fields:string) {
  let config; try{config=integrationConfig(channel);}catch{throw new IntakeError('CONFIGURATION');}
  if(!/^\d{1,128}$/.test(id))throw new IntakeError('INVALID_CONTACT');
  const host=channel==='meta_ads'?'graph.facebook.com':'graph.instagram.com';
  const url=new URL(`https://${host}/${config.version}/${id}`);url.searchParams.set('fields',fields);
  try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${config.accessToken}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error();
    const body=await boundedBody(new Request('https://local.invalid',{method:'POST',body:response.body,duplex:'half'} as RequestInit));
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  }catch{throw new IntakeError('GRAPH_UNAVAILABLE');}
}
export async function enquiryForEvent(event: InboundEvent) {
  const details=event.channel==='meta_ads'?await graph('meta_ads',event.externalId,'id,form_id,field_data'):
    event.channel==='instagram'?await graph('instagram',event.senderId ?? '','name,username'):null;
  try{return providerEnquiry(event,details);}catch{throw new IntakeError('INVALID_CONTACT');}
}

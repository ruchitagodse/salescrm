import { analystInput, analystSnapshot, type AnalystState, type AnalystFocus, type AnalystSnapshot, type AnalystOutput } from "./analyst-values.ts";
import type { AnalyticsRaw } from "./analytics-types.ts";
type Dependencies={
  authorize:()=>Promise<{id:string}>;
  config:()=>{key:string;model:string};
  acquire:(userId:string,now:number)=>()=>void;
  load:(input:{start:string;end:string})=>Promise<AnalyticsRaw>;
  generate:(snapshot:AnalystSnapshot,focus:AnalystFocus,config:{key:string;model:string})=>Promise<AnalystOutput>;
  now:()=>Date;
};
export async function runAnalyst(input:unknown,deps:Dependencies):Promise<AnalystState>{
  // Auth/Next redirects must propagate, outside generic-error handling.
  const user=await deps.authorize();
  let parsed;
  try{parsed=analystInput(input,deps.now());}catch{return {message:'Choose valid dates and an analysis focus.'};}
  let config;try{config=deps.config();}catch{return {message:'AI generation is unavailable. Ask the owner to finish Gemini setup.'};}
  let release;try{release=deps.acquire(user.id,deps.now().getTime());}catch{return {message:'Please wait before requesting another report.'};}
  try{
    const raw=await deps.load({start:parsed.start,end:parsed.end});
    const snapshot=analystSnapshot(raw,parsed.range);
    const report=await deps.generate(snapshot,parsed.focus,config);
    return {message:'Analysis generated. Review the evidence before acting.',result:{snapshot,report,focus:parsed.focus,model:config.model,generatedAt:deps.now().toISOString()}};
  }catch{return {message:'Unable to generate analysis. Please try again later.'};}
  finally{release();}
}

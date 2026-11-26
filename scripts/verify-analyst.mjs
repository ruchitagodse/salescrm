import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { analyticsQuery } from '../src/lib/analytics-query.ts';
import { analyticsRange } from '../src/lib/analytics-values.ts';
import { analystSnapshot } from '../src/lib/analyst-values.ts';
import { analystRequest,MODEL_ID } from '../src/lib/analyst-provider.ts';
config({path:'.env.local',quiet:true});
console.log(JSON.stringify({environment:['GEMINI_API_KEY','GEMINI_MODEL'].map(name=>({name,present:Boolean(process.env[name])})),modelFormatValid:Boolean(process.env.GEMINI_MODEL&&MODEL_ID.test(process.env.GEMINI_MODEL)),liveGeminiRequest:false}));
for(const connection of ['DATABASE_URL_MIGRATIONS','DATABASE_URL']){
 let client;
 try{
  if(!process.env[connection])throw new Error();client=postgres(process.env[connection],{prepare:false,max:1,connect_timeout:8});const db=drizzle(client);
  const checks=await db.transaction(async tx=>{
   const range=analyticsRange({},new Date());const [{report}]=await tx.execute(analyticsQuery(range));const snapshot=analystSnapshot(report,range);
   const allowed=['asOf','start','end','facts'];const body=JSON.stringify(analystRequest(snapshot,'overview'));
   return {topLevelAllowlist:Object.keys(snapshot).every(k=>allowed.includes(k)),boundedFacts:snapshot.facts.length<=50,boundedRequest:new TextEncoder().encode(body).length<=32768,
    noRecordRows:!('balances' in snapshot),exactNumericFacts:snapshot.facts.every(f=>f.unit==='percent'||/^-?\d+$/.test(f.value)),distinctEvidenceIds:new Set(snapshot.facts.map(f=>f.id)).size===snapshot.facts.length};
  },{isolationLevel:'repeatable read',accessMode:'read only'});
  const passed=Object.values(checks).every(Boolean);console.log(JSON.stringify({connection,passed,checks,businessWrites:false,liveGeminiRequest:false}));if(!passed)process.exitCode=1;
 }catch{console.error(JSON.stringify({connection,passed:false,rawDetails:'suppressed'}));process.exitCode=1;}
 finally{if(client)await client.end({timeout:1});}
}

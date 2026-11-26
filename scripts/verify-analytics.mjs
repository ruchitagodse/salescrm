import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { analyticsQuery } from '../src/lib/analytics-query.ts';
import { analyticsRange } from '../src/lib/analytics-values.ts';
config({path:'.env.local',quiet:true});
for (const connection of ['DATABASE_URL_MIGRATIONS','DATABASE_URL']) {
  let client;
  try {
    if (!process.env[connection]) throw new Error();
    client=postgres(process.env[connection],{prepare:false,max:1,connect_timeout:8});
    const db=drizzle(client);
    const checks=await db.transaction(async tx => {
      const [{report:r}]=await tx.execute(analyticsQuery(analyticsRange({},new Date())));
      const sum=(rows,key)=>rows.reduce((n,row)=>n+BigInt(row[key]),0n);
      return {monthlyReceipts:sum(r.monthly,'receipts')===BigInt(r.receipts),monthlyExpenses:sum(r.monthly,'expenses')===BigInt(r.expenses),
        leadSources:sum(r.sources,'count')===BigInt(r.leadCount),leadStatuses:sum(r.leadStatuses,'count')===BigInt(r.leadCount),
        conversionBound:BigInt(r.convertedCount)<=BigInt(r.leadCount),dealStages:sum(r.dealStages,'count')===BigInt(r.dealCount),
        dealOutcomes:sum(r.dealOutcomes,'count')===BigInt(r.dealCount),pipelineCount:sum(r.pipeline,'count')===BigInt(r.openDeals),
        pipelineValue:sum(r.pipeline,'value')===BigInt(r.openPipeline),pipelineUnknown:sum(r.pipeline,'unknown')===BigInt(r.unknownValues),
        nonnegativeOutstanding:BigInt(r.outstanding)>=0n,balancesLimit:r.balances.length<=10};
    },{isolationLevel:'repeatable read',accessMode:'read only'});
    const passed=Object.values(checks).every(Boolean); console.log(JSON.stringify({connection,passed,checks})); if(!passed)process.exitCode=1;
  }catch{console.error(JSON.stringify({connection,passed:false,rawDetails:'suppressed'}));process.exitCode=1;}
  finally{if(client)await client.end({timeout:1});}
}

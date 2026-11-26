import "server-only";
import { generateAnalystReport } from "../analyst-provider";
import type { AnalystSnapshot, AnalystFocus } from "../analyst-values";
// Production entry point; pure transport below is injectable for offline tests.
export async function generateGeminiAnalysis(snapshot:AnalystSnapshot,focus:AnalystFocus,config:{key:string;model:string}){
  return generateAnalystReport(snapshot,focus,config);
}

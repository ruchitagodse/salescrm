"use server";
import { requireUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/data/analytics";
import { analystConfig } from "@/lib/ai/config";
import { generateGeminiAnalysis } from "@/lib/ai/gemini";
import { createAnalystLimiter } from "@/lib/analyst-limit";
import { runAnalyst } from "@/lib/analyst-run";
import type { AnalystState } from "@/lib/analyst-values";
const acquire=createAnalystLimiter();
export async function generateAnalysis(_previous:AnalystState,data:FormData):Promise<AnalystState>{
  return runAnalyst({start:data.get('start'),end:data.get('end'),focus:data.get('focus')},{
    authorize:requireUser,config:analystConfig,acquire,load:getAnalytics,generate:generateGeminiAnalysis,now:()=>new Date(),
  });
}

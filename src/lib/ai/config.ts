import "server-only";
import { MODEL_ID } from "../analyst-provider";
export function analystConfig(){
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
  if(!key || !model || !MODEL_ID.test(model))throw new Error('AI unavailable');
  return {key,model};
}
export function analystConfigStatus(){
  return {keyPresent:Boolean(process.env.GEMINI_API_KEY),modelPresent:Boolean(process.env.GEMINI_MODEL),
    ready:Boolean(process.env.GEMINI_API_KEY&&process.env.GEMINI_MODEL&&MODEL_ID.test(process.env.GEMINI_MODEL))};
}

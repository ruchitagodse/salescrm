import { parseInbound, type Channel, type InboundEvent } from "./integration-values.ts";
import { boundedBody, equalToken, validSignature } from "./webhook-security.ts";
const reply=(status:number,message:string)=>new Response(message,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
type Dependencies = {
  config:()=>{secret:string;verifyToken:string;accountId:string};
  store:(events:InboundEvent[])=>Promise<{id:string;state:string;errorCode:string|null}[]>;
  process:(id:string)=>Promise<{processed:boolean;retryable:boolean}>;
};
// The real route uses this boundary; injectable dependencies keep tests offline.
export function createWebhookHandlers(channel:Channel,deps:Dependencies){return {
  async GET(request:Request){
    let config;try{config=deps.config();}catch{return reply(503,'Unavailable');}
    const params=new URL(request.url).searchParams;
    if(params.getAll('hub.mode').length!==1 || params.getAll('hub.verify_token').length!==1 || params.getAll('hub.challenge').length!==1 || params.get('hub.mode')!=='subscribe' || !equalToken(params.get('hub.verify_token'),config.verifyToken))return reply(403,'Forbidden');
    const challenge=params.get('hub.challenge');return challenge && /^\d{1,100}$/.test(challenge)?reply(200,challenge):reply(400,'Invalid request');
  },
  async POST(request:Request){
    let config;try{config=deps.config();}catch{return reply(503,'Unavailable');}
    let raw;try{raw=await boundedBody(request);}catch(error){return reply(error instanceof RangeError?413:400,'Invalid request');}
    if(!validSignature(raw,request.headers.get('x-hub-signature-256'),config.secret))return reply(401,'Unauthorized');
    let events;try{events=parseInbound(channel,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),config.accountId);}catch{return reply(400,'Invalid request');}
    try{
      const saved=await deps.store(events);
      const pending=saved.filter(e=>e.state==='received'||(e.state==='needs_review'&&['GRAPH_UNAVAILABLE','RETRY','DATABASE_ERROR','PROCESSING_FAILED'].includes(e.errorCode ?? '')));
      pending.sort((a,b)=>Number(b.state==='received')-Number(a.state==='received'));
      let retry=pending.length>10;
      for(const event of pending.slice(0,10)){const result=await deps.process(event.id);retry ||= result.retryable;}
      return reply(retry?503:200,retry?'Retry later':'EVENT_RECEIVED');
    }catch{return reply(503,'Unavailable');}
  },
};}

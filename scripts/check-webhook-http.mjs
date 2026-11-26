import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
// Production HTTP checks with synthetic channel configuration. Only status-only
// callbacks are accepted, so this script creates no contacts, leads or events.
// No credential/environment values, callback URLs or response bodies are printed.
let child;const checks=[];
try{
 const reservation=createServer();await new Promise((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
 const port=reservation.address().port;await new Promise((resolve,reject)=>reservation.close(e=>e?reject(e):resolve()));
 const secret=randomUUID(),token=randomUUID(),account='123456789';
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  windowsHide:true,stdio:'ignore',env:{...process.env,WHATSAPP_APP_SECRET:secret,WHATSAPP_VERIFY_TOKEN:token,WHATSAPP_PHONE_NUMBER_ID:account},
 });
 let spawnError;child.once('error',e=>{spawnError=e;});
 const origin=`http://127.0.0.1:${port}`;
 let ready=false;
 for(let i=0;i<80;i++){
  if(spawnError)throw spawnError;if(child.exitCode!==null)throw new Error();
  try{await fetch(origin+'/login',{redirect:'manual',signal:AbortSignal.timeout(1000)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}
 }
 if(!ready)throw new Error();
 const check=async(name,path,options,expected)=>{
  const response=await fetch(origin+path,{...options,redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(response.status!==expected)throw new Error();checks.push(name);return response;
 };
 const query=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':token,'hub.challenge':'987654321'});
 const response=await check('public_signed_route_challenge','/api/webhooks/whatsapp?'+query,{},200);
 if(await response.text()!=='987654321')throw new Error();
 await check('wrong_verification_token_rejected','/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1',{},403);
 const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'test',changes:[{field:'messages',value:{metadata:{phone_number_id:account},statuses:[{id:'test',status:'delivered'}]}}]}]});
 await check('missing_signature_rejected','/api/webhooks/whatsapp',{method:'POST',body},401);
 await check('valid_status_only_delivery_ignored','/api/webhooks/whatsapp',{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')}},200);
 for(const path of ['/integrations','/analyst','/analyst?start=invalid','/api/webhooks/whatsapp/admin','/api/health/db']){
  const r=await check('protected_route_redirect',path,{},307);if(new URL(r.headers.get('location'),origin).pathname!=='/login')throw new Error();
 }
 console.log(JSON.stringify({passed:true,checks,syntheticConfiguration:true,businessWrites:false}));
}catch(error){console.error(JSON.stringify({passed:false,checks,code:typeof error?.code==='string'?error.code:null,rawDetails:'suppressed'}));process.exitCode=1;}
finally{if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,2000);});}}

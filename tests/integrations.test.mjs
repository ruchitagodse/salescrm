import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validSignature, equalToken, boundedBody, MAX_WEBHOOK_BYTES, isWebhookPath } from '../src/lib/webhook-security.ts';
import { parseInbound } from '../src/lib/integration-values.ts';
import { createWebhookHandlers } from '../src/lib/webhook-handler.ts';
import { providerEnquiry } from '../src/lib/integration-enquiry.ts';
const secret='synthetic-test-secret';
const sign=raw=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
const wa=(messages=[{from:'919876543210',id:'wamid.test',timestamp:'1760000000',type:'text',text:{body:'Hello'}}])=>({object:'whatsapp_business_account',entry:[{id:'waba',changes:[{field:'messages',value:{metadata:{phone_number_id:'123'},messages,contacts:[{wa_id:'919876543210',profile:{name:'Test'}}]}}]}]});
const post=(body,signature=sign(body),headers={})=>new Request('https://os.invalid/api/webhooks/whatsapp',{method:'POST',body,headers:{'x-hub-signature-256':signature,...headers}});
test('HMAC verifies exact bytes and fails malformed, missing or altered signatures',()=>{
 const raw=Buffer.from('{"x":"₹"}');assert.equal(validSignature(raw,sign(raw),secret),true);
 for(const s of [null,'sha1=abc','sha256=aa','sha256='+'z'.repeat(64)])assert.equal(validSignature(raw,s,secret),false);
 assert.equal(validSignature(Buffer.from('{ "x":"₹"}'),sign(raw),secret),false);
 assert.equal(validSignature(raw,sign(raw),'wrong'),false);
 assert.equal(equalToken('same','same'),true);assert.equal(equalToken('bad','same'),false);assert.equal(equalToken(null,'same'),false);
});
test('bounded body rejects oversized declared and streamed requests',async()=>{
 await assert.rejects(()=>boundedBody(post('a',undefined,{'content-length':String(MAX_WEBHOOK_BYTES+1)})));
 await assert.rejects(()=>boundedBody(post('a'.repeat(MAX_WEBHOOK_BYTES+1))));
 assert.equal(Buffer.from(await boundedBody(post('test'))).toString(),'test');
});
test('proxy exemptions are exact provider routes, not arbitrary APIs or children',()=>{
 assert.equal(isWebhookPath('/api/webhooks/whatsapp'),true);
 for(const p of ['/api/webhooks/whatsapp/admin','/api/webhooks/whatsapp/','/api/webhooks','/api/health/db'])assert.equal(isWebhookPath(p),false);
});
test('WhatsApp extracts normalized text, ignores status notifications and validates account',()=>{
 const [e]=parseInbound('whatsapp',wa(),'123');assert.equal(e.body,'Hello');assert.equal(e.senderId,'919876543210');assert.equal(e.displayName,'Test');
 const status=wa([]);status.entry[0].changes[0].value.statuses=[{id:'sent'}];assert.deepEqual(parseInbound('whatsapp',status,'123'),[]);
 assert.throws(()=>parseInbound('whatsapp',wa(),'456'));
 const media=parseInbound('whatsapp',wa([{from:'919876543210',id:'wamid.media',timestamp:'1760000000',type:'image',image:{url:'https://untrusted.invalid'}}]),'123')[0];assert.equal(media.body,null);assert.equal('image' in media,false);
});
test('Instagram scopes sender/recipient IDs and ignores echoes/read notifications',()=>{
 const p={object:'instagram',entry:[{id:'123',messaging:[{sender:{id:'456'},recipient:{id:'123'},timestamp:1760000000000,message:{mid:'mid.1',text:'Hi'}}]}]};
 assert.equal(parseInbound('instagram',p,'123')[0].senderId,'456');
 p.entry[0].messaging[0].message.is_echo=true;assert.deepEqual(parseInbound('instagram',p,'123'),[]);
 delete p.entry[0].messaging[0].message;assert.deepEqual(parseInbound('instagram',p,'123'),[]);
 assert.throws(()=>parseInbound('instagram',p,'789'));
});
test('Meta lead notifications retain lead/form/ad IDs and reject cross-page events',()=>{
 const p={object:'page',entry:[{id:'123',changes:[{field:'leadgen',value:{page_id:'123',leadgen_id:'999',form_id:'777',ad_id:'888',created_time:1760000000}}]}]};
 const [e]=parseInbound('meta_ads',p,'123');assert.equal(e.externalId,'999');assert.equal(e.formId,'777');assert.equal(e.adId,'888');assert.equal(e.body,null);
 p.entry[0].changes[0].value.page_id='456';assert.throws(()=>parseInbound('meta_ads',p,'123'));
});
test('HTTP challenge checks mode/token/duplicate parameters without storage',async()=>{
 const handler=createWebhookHandlers('whatsapp',{config:()=>({secret,verifyToken:'verify',accountId:'123'}),store:()=>{throw new Error('must not store')},process:()=>{throw new Error('must not process')}});
 const req=q=>new Request('https://os.invalid/?'+q);
 const ok=await handler.GET(req('hub.mode=subscribe&hub.verify_token=verify&hub.challenge=123'));assert.equal(ok.status,200);assert.equal(await ok.text(),'123');
 assert.equal((await handler.GET(req('hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123'))).status,403);
 assert.equal((await handler.GET(req('hub.mode=subscribe&hub.verify_token=verify&hub.verify_token=bad&hub.challenge=123'))).status,403);
});
test('HTTP signature/account validation precedes all storage and processing',async()=>{
 let stored=0,processed=0;
 const handler=createWebhookHandlers('whatsapp',{config:()=>({secret,verifyToken:'verify',accountId:'123'}),store:async()=>{stored++;return[]},process:async()=>{processed++;return{processed:true,retryable:false}}});
 assert.equal((await handler.POST(post('{bad','sha256='+'0'.repeat(64)))).status,401);
 assert.equal((await handler.POST(post('{bad'))).status,400);
 const wrong=wa();wrong.entry[0].changes[0].value.metadata.phone_number_id='456';
 assert.equal((await handler.POST(post(JSON.stringify(wrong)))).status,400);assert.equal(stored,0);assert.equal(processed,0);
 assert.equal((await handler.POST(post(JSON.stringify(wa())))).status,200);assert.equal(stored,1);
});
test('HTTP duplicate successes are skipped, transient failures retry, errors stay generic',async()=>{
 let processed=0;let state='processed';
 const handler=createWebhookHandlers('whatsapp',{config:()=>({secret,verifyToken:'verify',accountId:'123'}),store:async()=>[{id:'test',state,errorCode:null}],process:async()=>{processed++;return{processed:false,retryable:true}}});
 assert.equal((await handler.POST(post(JSON.stringify(wa())))).status,200);assert.equal(processed,0);
 state='received';assert.equal((await handler.POST(post(JSON.stringify(wa())))).status,503);assert.equal(processed,1);
 const failing=createWebhookHandlers('whatsapp',{config:()=>{throw new Error('PRIVATE')},store:async()=>[],process:async()=>({processed:true,retryable:false})});
 const response=await failing.POST(post('{}'));assert.equal(response.status,503);assert.equal(await response.text(),'Unavailable');
});
test('WhatsApp enquiry maps real phone, forces integration source, rejects opaque-only identities',()=>{
 const event=parseInbound('whatsapp',wa(),'123')[0];const enquiry=providerEnquiry(event);
 assert.equal(enquiry.contact.phone,'+919876543210');assert.equal(enquiry.lead.entryMethod,'integration');assert.equal(enquiry.lead.source,'whatsapp');assert.equal(enquiry.lead.status,'new');
 assert.equal(enquiry.lead.requirement,'Hello');assert.throws(()=>providerEnquiry({...event,senderId:'US.opaque'}));
});
test('Instagram enquiry uses an actual username and accepts missing profile name',()=>{
 const event={channel:'instagram',accountId:'123',senderId:'456',externalId:'mid.1',kind:'text',body:'Hi',formId:null,adId:null,occurredAt:new Date()};
 const enquiry=providerEnquiry(event,{username:'real_user',name:null});assert.equal(enquiry.contact.fullName,'real_user');assert.equal(enquiry.contact.instagramHandle,'real_user');
 assert.throws(()=>providerEnquiry(event,{name:'Only a name'}));
});
test('Meta form mapping validates IDs and contact information without guessing custom fields',()=>{
 const event={channel:'meta_ads',accountId:'123',senderId:null,externalId:'999',kind:'lead_form',body:null,formId:'777',adId:'888',occurredAt:new Date()};
 const details={id:'999',form_id:'777',field_data:[{name:'full_name',values:['Test Person']},{name:'email',values:['TEST@example.com']},{name:'custom_budget',values:['1.2e10']}]};
 const enquiry=providerEnquiry(event,details);assert.equal(enquiry.contact.email,'test@example.com');assert.equal(enquiry.lead.budgetPaise,undefined);assert.match(enquiry.lead.sourceDetail,/form=777; ad=888/);
 assert.throws(()=>providerEnquiry(event,{...details,id:'111'}));
 assert.throws(()=>providerEnquiry(event,{...details,field_data:[{name:'full_name',values:['Test']}] }));
});
test('bounded batch processes new events before transient retries and requests delivery retry for remainder',async()=>{
 const seen=[];const handler=createWebhookHandlers('whatsapp',{config:()=>({secret,verifyToken:'verify',accountId:'123'}),
  store:async()=>[{id:'old',state:'needs_review',errorCode:'GRAPH_UNAVAILABLE'},...Array.from({length:11},(_,i)=>({id:`new${i}`,state:'received',errorCode:null}))],
  process:async id=>{seen.push(id);return{processed:true,retryable:false}}});
 assert.equal((await handler.POST(post(JSON.stringify(wa())))).status,503);assert.equal(seen.length,10);assert.equal(seen.includes('old'),false);
});
